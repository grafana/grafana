/**
 * Generate per-app Zod schemas from CUE kinds, via kubb.
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/codegen/gen-zod.ts                # all apps, all versions
 *   yarn ts-node --transpile-only scripts/codegen/gen-zod.ts dashboard iam  # specific apps (all their versions)
 *   yarn ts-node --transpile-only scripts/codegen/gen-zod.ts dashboard/v2beta1  # specific app/version pairs
 *   yarn ts-node --transpile-only scripts/codegen/gen-zod.ts dashboard/v2beta1 dashboard/v2alpha1  # mix of pairs
 *
 * Pipeline:
 *   For each (app, version) under apps/:
 *     1. Materialize a wrapper subpackage `apps/<app>/kinds/<version>/_zodgen/aliases.cue`
 *        with `package _zodgen` + `import "<module>/<version>"` + `#X: <pkg>.X` per type.
 *        (CUE's OpenAPI emitter only exports `#`-prefixed definitions, so we wrap.)
 *     2. Run `cue def --out openapi .` from inside the wrapper to get an OpenAPI doc.
 *     3. Inject `discriminator: { propertyName: 'kind' }` into every `oneOf` whose
 *        branches are `$ref`s to objects with a single-value `kind` enum
 *        (CUE never emits these; kubb honors them via `pluginOas({ discriminator: 'inherit' })`).
 *     4. Write the OpenAPI doc to a tmp file and record a manifest entry
 *        `{ inputPath, outputPath, banner }`.
 *
 *   Then run `kubb --config scripts/codegen/kubb.config.ts` ONCE with
 *   `GEN_ZOD_MANIFEST` pointing at the manifest. kubb maps the manifest into
 *   one pipeline per entry and writes `apps/<app>/zod-schemas/<version>/*.ts`
 *   (one file per OpenAPI component) plus a `barrelType: 'named'` index.
 *
 *   Each per-target output dir is then collapsed into a single
 *   `apps/<app>/zod-schemas/<version>/index.ts` containing every schema, with
 *   intra-dir imports stripped (kubb wraps cross-refs in property getters, so
 *   declaration order is irrelevant). Prettier is run on the bundle.
 *
 *   During the bundle pass we also apply mechanical post-processes:
 *     L1: rewrite single-value `kind: z.enum(['Foo'])` to
 *         `kind: z.literal('Foo').optional().default('Foo')` so consumers can
 *         omit the discriminator. Skipped for schemas that participate in a
 *         discriminated union (Zod 4 rejects unions whose branches all accept
 *         `undefined`).
 *
 * Wrapper subpackages and the tmp manifest/openapi files are removed at the end.
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const APPS_DIR = join(REPO_ROOT, 'apps');
const WRAPPER_DIR_NAME = '_zodgen';
const ZOD_OUTPUT_ROOT = 'zod-schemas';
const KUBB_CLI = join(REPO_ROOT, 'node_modules', '.bin', 'kubb');
const KUBB_CONFIG = join(__dirname, 'kubb.config.ts');

const BANNER_HEADER = `// Code generated - EDITING IS FUTILE. DO NOT EDIT.
// Run \`yarn ts-node --transpile-only scripts/codegen/gen-zod.ts\` from the repository root to regenerate.`;

// ----- types -----

/** Subset of OpenAPI 3.0 / JSON Schema we actually inspect for discriminator injection. */
interface JsonSchema {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  oneOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  $ref?: string;
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
}

interface OpenApiDoc {
  components?: { schemas?: Record<string, JsonSchema> };
}

interface AppTarget {
  app: string; // friendly name, e.g. "dashboard" or "alerting/notifications"
  kindsDir: string; // absolute path to apps/<app>/kinds
  modulePath: string; // CUE module path declared in cue.mod/module.cue
  versions: string[]; // e.g. ["v2alpha1", "v2beta1"]
}

interface TypeDecl {
  name: string;
  isDef: boolean; // true for `#`-prefixed CUE definitions
}

interface ManifestEntry {
  inputPath: string;
  outputPath: string;
  banner: string;
  /** Schemas to skip the L1 (kind → optional+default) post-process for. */
  unionMembers: string[];
}

interface PreparedTarget {
  entry: ManifestEntry;
  typeCount: number;
  injected: number;
  /** Schema names (kubb form, e.g. 'panelKindSchema') that participate in a discriminated union. */
  unionMembers: string[];
}

// ----- discovery -----

function findKindsModuleDirs(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) {
      return;
    }
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) {
        continue;
      }
      const child = join(dir, name);
      if (!statSync(child).isDirectory()) {
        continue;
      }
      if (name === 'kinds' && existsSync(join(child, 'cue.mod', 'module.cue'))) {
        out.push(child);
        continue;
      }
      walk(child);
    }
  };
  walk(APPS_DIR);
  return out;
}

function readModulePath(kindsDir: string): string {
  const text = readFileSync(join(kindsDir, 'cue.mod', 'module.cue'), 'utf8');
  const m = text.match(/^\s*module:\s*"([^"]+)"/m);
  if (!m) {
    throw new Error(`could not parse module path from ${kindsDir}/cue.mod/module.cue`);
  }
  return m[1];
}

function findVersions(kindsDir: string): string[] {
  return readdirSync(kindsDir)
    .filter((name) => /^v\d+([a-z0-9]+)?$/.test(name))
    .filter((name) => statSync(join(kindsDir, name)).isDirectory())
    .filter((name) => readdirSync(join(kindsDir, name)).some((f) => f.endsWith('.cue')))
    .sort();
}

/**
 * Parses positional CLI args of the form `app` (all versions) or `app/version` (specific
 * version) into a per-app version restriction. Returns `null` when no filter is given,
 * meaning every (app, version) is selected.
 */
function parseFilter(args: string[]): Map<string, Set<string> | null> | null {
  if (args.length === 0) {
    return null;
  }
  const restrictions = new Map<string, Set<string> | null>();
  for (const arg of args) {
    if (!arg.includes('/')) {
      // Bare app name → all versions (overrides any prior version restriction).
      restrictions.set(arg, null);
      continue;
    }
    // app may itself contain '/' (e.g. "alerting/notifications/v1beta1"). The version
    // is the last segment that matches a vN[xxx] pattern.
    const lastSlash = arg.lastIndexOf('/');
    const candidateVersion = arg.slice(lastSlash + 1);
    if (!/^v\d+([a-z0-9]+)?$/.test(candidateVersion)) {
      throw new Error(`could not parse "${arg}" as app or app/version (expected version like vN, vNalpha1, vNbeta1)`);
    }
    const app = arg.slice(0, lastSlash);
    const existing = restrictions.get(app);
    if (existing === null) {
      continue;
    } // already unrestricted by a bare app entry
    const versions = existing ?? new Set<string>();
    versions.add(candidateVersion);
    restrictions.set(app, versions);
  }
  return restrictions;
}

function discoverTargets(filter: Map<string, Set<string> | null> | null): AppTarget[] {
  const targets: AppTarget[] = [];
  for (const kindsDir of findKindsModuleDirs()) {
    const app = relative(APPS_DIR, dirname(kindsDir));
    if (filter && !filter.has(app)) {
      continue;
    }
    const allVersions = findVersions(kindsDir);
    const allowed = filter?.get(app) ?? null;
    const versions = allowed ? allVersions.filter((v) => allowed.has(v)) : allVersions;
    if (versions.length === 0) {
      continue;
    }
    targets.push({ app, kindsDir, modulePath: readModulePath(kindsDir), versions });
  }
  return targets;
}

// ----- wrapper materialization + cue export -----

// Matches both regular top-level CUE fields (`Foo:`) and CUE definitions (`#Foo:`).
const TYPE_NAME_RE = /^(#?)([A-Z][A-Za-z0-9]*)\s*:/gm;

function extractTopLevelTypes(versionDir: string): TypeDecl[] {
  const seen = new Map<string, TypeDecl>();
  for (const file of readdirSync(versionDir)) {
    if (!file.endsWith('.cue')) {
      continue;
    }
    const text = readFileSync(join(versionDir, file), 'utf8');
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    let m: RegExpExecArray | null;
    TYPE_NAME_RE.lastIndex = 0;
    while ((m = TYPE_NAME_RE.exec(stripped))) {
      const isDef = m[1] === '#';
      const name = m[2];
      const existing = seen.get(name);
      if (!existing || (!existing.isDef && isDef)) {
        seen.set(name, { name, isDef });
      }
    }
  }
  // eslint-disable-next-line @grafana/no-locale-compare -- sorting a small set of CUE type names per app/version
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function writeWrapper(versionDir: string, modulePath: string, version: string, types: TypeDecl[]): string {
  const wrapperDir = join(versionDir, WRAPPER_DIR_NAME);
  mkdirSync(wrapperDir, { recursive: true });
  const importPath = `${modulePath}/${version}`;
  const lines = [
    `package ${WRAPPER_DIR_NAME}`,
    '',
    `import ${version} "${importPath}"`,
    '',
    ...types.map((t) => `#${t.name}: ${version}.${t.isDef ? '#' : ''}${t.name}`),
    '',
  ];
  writeFileSync(join(wrapperDir, 'aliases.cue'), lines.join('\n'));
  return wrapperDir;
}

function runCueDef(wrapperDir: string): OpenApiDoc {
  const stdout = execFileSync('cue', ['def', '--out', 'openapi', '.'], {
    cwd: wrapperDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const doc: OpenApiDoc = JSON.parse(stdout);
  return doc;
}

// ----- discriminator injection -----

const TOP_LEVEL_REF_RE = /^#\/components\/schemas\/(.+)$/;

function singleValueKindEnum(prop: JsonSchema | undefined): string | null {
  if (!prop || prop.type !== 'string') {
    return null;
  }
  if (typeof prop.const === 'string') {
    return prop.const;
  }
  if (Array.isArray(prop.enum) && prop.enum.length === 1) {
    const value = prop.enum[0];
    if (typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * For every `oneOf` (top-level or nested), if each branch is a `$ref` to an object schema
 * with a single-value `kind` enum, attach an OpenAPI 3.0 discriminator block. CUE's OpenAPI
 * emitter never produces these — but kubb's pluginOas honors them (with `discriminator: 'inherit'`)
 * to emit a clean per-branch `z.union` instead of intersection-based narrowing.
 *
 * Also returns the set of OpenAPI schema names that ended up as discriminated-union branches.
 * Downstream post-processing (L1) skips these when rewriting `kind` to optional+default,
 * because Zod 4 rejects `discriminatedUnion` over branches that all accept `undefined`
 * (the "Duplicate discriminator value 'undefined'" error).
 */
function isJsonSchemaNode(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function injectDiscriminators(
  doc: OpenApiDoc,
  discriminatorField = 'kind'
): { injected: number; unionMembers: Set<string> } {
  const defs = doc.components?.schemas ?? {};
  let injected = 0;
  const unionMembers = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (!isJsonSchemaNode(node)) {
      return;
    }

    if (Array.isArray(node.oneOf) && node.oneOf.length > 0 && !node.discriminator) {
      const mapping: Record<string, string> = {};
      const branchNames: string[] = [];
      let allOk = true;

      for (const branch of node.oneOf) {
        if (typeof branch?.$ref !== 'string') {
          allOk = false;
          break;
        }
        const m = branch.$ref.match(TOP_LEVEL_REF_RE);
        if (!m) {
          allOk = false;
          break;
        }
        const def = defs[m[1]];
        if (!def || def.type !== 'object') {
          allOk = false;
          break;
        }
        const value = singleValueKindEnum(def.properties?.[discriminatorField]);
        if (!value) {
          allOk = false;
          break;
        }
        if (!Array.isArray(def.required) || !def.required.includes(discriminatorField)) {
          allOk = false;
          break;
        }
        if (mapping[value]) {
          allOk = false;
          break;
        }
        mapping[value] = branch.$ref;
        branchNames.push(m[1]);
      }

      if (allOk) {
        node.discriminator = { propertyName: discriminatorField, mapping };
        injected += 1;
        for (const name of branchNames) {
          unionMembers.add(name);
        }
      }
    }

    // Recurse into every value of the node so we visit nested oneOfs (inside
    // properties, items, allOf, etc.) without enumerating each container key.
    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(doc);
  return { injected, unionMembers };
}

/** OpenAPI schema name → kubb-emitted const name (e.g. 'PanelKind' → 'panelKindSchema'). */
function openApiNameToSchemaConst(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1) + 'Schema';
}

// ----- per-target preparation -----

function prepareTarget(target: AppTarget, version: string, openApiDir: string): PreparedTarget | null {
  const versionDir = join(target.kindsDir, version);
  const types = extractTopLevelTypes(versionDir);
  if (types.length === 0) {
    return null;
  }

  const wrapperDir = writeWrapper(versionDir, target.modulePath, version, types);
  let doc: OpenApiDoc;
  try {
    doc = runCueDef(wrapperDir);
  } finally {
    rmSync(wrapperDir, { recursive: true, force: true });
  }

  const { injected, unionMembers } = injectDiscriminators(doc);
  const unionMemberConsts = [...unionMembers].map(openApiNameToSchemaConst).sort();

  const safeApp = target.app.replace(/\//g, '__');
  const inputPath = join(openApiDir, `${safeApp}__${version}.openapi.json`);
  writeFileSync(inputPath, JSON.stringify(doc));

  const outputPath = join(REPO_ROOT, 'apps', target.app, ZOD_OUTPUT_ROOT, version);
  mkdirSync(outputPath, { recursive: true });

  const banner = `${BANNER_HEADER}\n// Source: apps/${target.app}/kinds/${version}/*.cue (via cue def --out openapi).`;

  return {
    entry: { inputPath, outputPath, banner, unionMembers: unionMemberConsts },
    typeCount: types.length,
    injected,
    unionMembers: unionMemberConsts,
  };
}

// ----- kubb -----

function runKubb(manifestPath: string): void {
  const result = spawnSync(KUBB_CLI, ['--config', KUBB_CONFIG], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, GEN_ZOD_MANIFEST: manifestPath },
  });
  if (result.status !== 0) {
    throw new Error(`kubb exited with code ${result.status}`);
  }
}

// ----- bundling -----

const PRETTIER_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'prettier');
// Per-file banner kubb stamped via pluginZod's `banner` (= our BANNER_HEADER + Source line).
const PER_FILE_BANNER_RE = /^\/\/ Code generated[\s\S]*?\n\/\/ Source:[^\n]*\n/m;
// Kubb's own JSDoc header it adds to every generated file.
const KUBB_HEADER_RE = /\/\*\*\s*\n\s*\*\s*Generated by Kubb[\s\S]*?\*\/\s*\n?/;
const INTRA_IMPORT_RE = /^import\s+\{[^}]+\}\s+from\s+['"]\.\/[^'"]+['"];?\s*$/gm;
const ZOD_IMPORT_RE = /^import\s+\{\s*z\s*\}\s+from\s+['"]zod\/v4['"];?\s*$/gm;
// L1: rewrite single-value `kind` enums to `.literal().optional().default()` so consumers
// can omit the kind field. Matches both `kind:` and `"kind":` (kubb's raw per-file output
// quotes property names; prettier strips them on the bundle pass).
// Skipped for schemas that participate in a discriminated union — Zod 4 rejects
// `discriminatedUnion` over branches that all accept `undefined`.
const KIND_SINGLE_ENUM_RE = /(["']?\bkind\b["']?:\s*)z\.enum\(\[(['"])([A-Za-z][A-Za-z0-9]*)\2\]\)/g;

/**
 * Collapses kubb's one-file-per-component output under `outDir` into a single
 * `index.ts`. Safe to do because every cross-schema reference kubb emits is
 * wrapped in a property getter (`get foo() { return barSchema.optional(); }`),
 * which defers name resolution until access — declaration order doesn't matter.
 */
function bundleTarget(outDir: string, banner: string, unionMembers: Set<string>): void {
  const sources = readdirSync(outDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .sort();

  const bodies: string[] = [];
  for (const file of sources) {
    const schemaConst = file.replace(/\.ts$/, '');
    let stripped = readFileSync(join(outDir, file), 'utf8')
      .replace(PER_FILE_BANNER_RE, '')
      .replace(KUBB_HEADER_RE, '')
      .replace(INTRA_IMPORT_RE, '')
      .replace(ZOD_IMPORT_RE, '')
      .trim();
    if (!unionMembers.has(schemaConst)) {
      stripped = stripped.replace(
        KIND_SINGLE_ENUM_RE,
        (_match, prefix: string, quote: string, value: string) =>
          `${prefix}z.literal(${quote}${value}${quote}).optional().default(${quote}${value}${quote})`
      );
    }
    if (stripped) {
      bodies.push(stripped);
    }
  }

  // Wipe everything kubb wrote under outDir — per-symbol .ts files, kubb's own
  // index.ts, and pluginOas's `schemas/` JSON dump dir (which it writes even
  // with `output: false`). The bundle is the only artifact we keep.
  for (const entry of readdirSync(outDir)) {
    rmSync(join(outDir, entry), { recursive: true, force: true });
  }

  const bundlePath = join(outDir, 'index.ts');
  writeFileSync(bundlePath, `${banner}\nimport { z } from 'zod/v4';\n\n${bodies.join('\n\n')}\n`);

  execFileSync(PRETTIER_BIN, ['--write', '--log-level=warn', bundlePath], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
}

// ----- main -----

async function main() {
  if (!existsSync(KUBB_CLI)) {
    throw new Error(`kubb CLI not found at ${KUBB_CLI}. Run \`yarn install\` first.`);
  }
  if (!existsSync(KUBB_CONFIG)) {
    throw new Error(`kubb config not found at ${KUBB_CONFIG}`);
  }

  const argv = process.argv.slice(2);
  const filter = parseFilter(argv);

  const targets = discoverTargets(filter);
  if (targets.length === 0) {
    console.log('No app targets discovered. (Pass app names as positional args to filter.)');
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'gen-zod-'));
  try {
    const entries: ManifestEntry[] = [];
    const summaries: string[] = [];

    for (const target of targets) {
      console.log(`Preparing ${target.app} (versions: ${target.versions.join(', ')})`);
      for (const version of target.versions) {
        const prepared = prepareTarget(target, version, tmpDir);
        if (!prepared) {
          summaries.push(`  ${target.app}/${version}: no top-level types, skipping`);
          continue;
        }
        entries.push(prepared.entry);
        summaries.push(
          `  ${target.app}/${version}: ${prepared.typeCount} types, ${prepared.injected} discriminator(s) injected`
        );
      }
    }

    if (entries.length === 0) {
      console.log('Nothing to generate.');
      return;
    }

    const manifestPath = join(tmpDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(entries));

    console.log(`\nRunning kubb on ${entries.length} target(s)...`);
    runKubb(manifestPath);

    console.log('\nBundling per-target outputs into single index.ts...');
    for (const entry of entries) {
      bundleTarget(entry.outputPath, entry.banner, new Set(entry.unionMembers));
    }

    console.log('\nDone:');
    summaries.forEach((s) => console.log(s));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
