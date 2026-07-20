import { spawnSync } from 'child_process';
import path from 'path';

import { type Variant, PACKAGE_ROOT, ALLOWED_GENERATE_COMMANDS, ALLOWED_FORMAT_COMMANDS } from './variants.ts';

/** Return the list of files that need formatting after generation. */
export function getFilesToFormat(variant: Variant, groupName: string, version: string): string[] {
  const subpath = `${groupName}/${version}`;
  return [
    `${variant.clientBase}/${subpath}/baseAPI.ts`,
    `${variant.clientBase}/${subpath}/index.ts`,
    variant.codegenScript,
    ...(variant.clientBase.startsWith(PACKAGE_ROOT)
      ? [`${PACKAGE_ROOT}/src/index.ts`, `${variant.clientBase}/index.ts`, `${PACKAGE_ROOT}/package.json`]
      : []),
  ];
}

/** Executables that are permitted to be spawned by runOrWarn. */
const ALLOWED_FORMAT_EXECUTABLES: readonly string[] = ['yarn'];

function runOrWarn(label: string, cmd: string, args: string[], cwd: string) {
  // Validate the executable against a strict allowlist before anything else.
  if (!ALLOWED_FORMAT_EXECUTABLES.includes(cmd)) {
    throw new Error(`Refusing to run disallowed executable: "${cmd}"`);
  }

  // Validate the combined command (executable + sub-command flags) against the
  // known-safe prefix allowlist, catching any unexpected sub-command injection.
  const command = [cmd, ...args].join(' ');
  if (!ALLOWED_FORMAT_COMMANDS.some((allowed) => command.startsWith(allowed))) {
    throw new Error(`Refusing to run disallowed format command: "${command}"`);
  }

  // Validate every argument that looks like a file path: it must resolve to a
  // location inside cwd so that crafted paths cannot escape the project root.
  const resolvedCwd = path.resolve(cwd);
  for (const arg of args) {
    // Skip flag arguments (e.g. --fix, --write, --ignore-path=…).
    if (arg.startsWith('-')) {
      continue;
    }
    const resolvedArg = path.resolve(arg);
    if (!resolvedArg.startsWith(resolvedCwd + path.sep) && resolvedArg !== resolvedCwd) {
      throw new Error(`Refusing to pass path outside of working directory: "${arg}"`);
    }
  }

  console.log(`🧹 Running ${label} on generated/modified files...`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'pipe', shell: false });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.toString() ?? `exit code ${result.status}`;
    console.warn(`⚠️ Warning: ${label} encountered issues: ${detail}`);
  }
}

/** Run ESLint + Prettier on the given files (paths relative to basePath). */
export function formatFiles(basePath: string, files: string[]) {
  const absolutePaths = files.map((f) => path.join(basePath, f));
  runOrWarn('ESLint', 'yarn', ['eslint', '--fix', ...absolutePaths], basePath);
  // --ignore-path so gitignored files (local/) can still be formatted
  runOrWarn('Prettier', 'yarn', ['prettier', '--write', ...absolutePaths, '--ignore-path=./.prettierignore'], basePath);
}

/** Run the RTK codegen to produce endpoints.gen.ts. */
export function runGenerateApis(basePath: string, variant: Variant) {
  if (!ALLOWED_GENERATE_COMMANDS.includes(variant.generateCommand)) {
    throw new Error(`Refusing to run disallowed generate command: "${variant.generateCommand}"`);
  }
  console.log(`⏳ Running ${variant.generateCommand} to generate endpoints...`);
  const [cmd, ...args] = variant.generateCommand.split(' ').filter(Boolean);
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: basePath, shell: false });
  if (result.error) {
    console.error(`❌ Failed to generate API endpoints: ${result.error.message}`);
    throw result.error;
  }
  if (result.status !== 0) {
    const err = new Error(`Command exited with code ${result.status}`);
    console.error(`❌ Failed to generate API endpoints: ${err.message}`);
    throw err;
  }
  console.log('✅ API endpoints generated successfully!');
}
