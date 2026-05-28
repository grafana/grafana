/**
 * Shared context loader for every impeccable command that needs to know
 * "who is this for" and "what does this look like".
 *
 * Input: project root (process.cwd()).
 *
 * Output (JSON to stdout):
 *   {
 *     hasProduct: boolean,        // PRODUCT.md found (or auto-migrated)
 *     product: string | null,     // PRODUCT.md contents
 *     productPath: string | null, // relative path
 *     hasDesign: boolean,         // DESIGN.md found
 *     design: string | null,      // DESIGN.md contents
 *     designPath: string | null,
 *     migrated: boolean,          // true if we auto-renamed .impeccable.md -> PRODUCT.md
 *     contextDir: string,         // absolute path of the directory the files were found in
 *   }
 *
 * Filename matching is case-insensitive for PRODUCT.md and DESIGN.md. The
 * Google DESIGN.md convention is uppercase at repo root; Kiro-style and
 * lowercase variants are also matched so users don't get punished for case.
 *
 * Lookup directory resolution (first match wins):
 *   1. process.env.IMPECCABLE_CONTEXT_DIR (absolute or relative to cwd)
 *   2. cwd, if PRODUCT.md / DESIGN.md / .impeccable.md is there (back-compat)
 *   3. Auto-fallback subdirectories of cwd: .agents/context/, then docs/
 *   4. cwd as a default "no context found" location
 *
 * Legacy `.impeccable.md` -> PRODUCT.md migration only fires at cwd root;
 * fallback directories are read-only as far as auto-rename is concerned.
 */

import fs from 'node:fs';
import path from 'node:path';

const PRODUCT_NAMES = ['PRODUCT.md', 'Product.md', 'product.md'];
const DESIGN_NAMES = ['DESIGN.md', 'Design.md', 'design.md'];
const LEGACY_NAMES = ['.impeccable.md'];
const FALLBACK_DIRS = ['.agents/context', 'docs'];

/**
 * Resolve the directory that holds PRODUCT.md / DESIGN.md for
 * this project. Exported so other scripts (e.g. live-server.mjs) can read the
 * design files from the same location the loader uses.
 */
export function resolveContextDir(cwd = process.cwd()) {
  // 1. Explicit override
  const envDir = process.env.IMPECCABLE_CONTEXT_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  }

  // 2. cwd wins if any canonical or legacy file is there. We check legacy too
  //    so the auto-migration path in loadContext stays predictable.
  if (firstExisting(cwd, [...PRODUCT_NAMES, ...DESIGN_NAMES, ...LEGACY_NAMES])) {
    return cwd;
  }

  // 3. Auto-fallback subdirs. Match if PRODUCT.md or DESIGN.md is present;
  //    legacy `.impeccable.md` does not pull the lookup into a fallback dir.
  for (const rel of FALLBACK_DIRS) {
    const candidate = path.resolve(cwd, rel);
    if (firstExisting(candidate, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
      return candidate;
    }
  }

  // 4. Nothing found — keep the historical "default to cwd" behaviour so the
  //    caller's `hasProduct === false` branch still fires the same way.
  return cwd;
}

export function loadContext(cwd = process.cwd()) {
  let migrated = false;
  const contextDir = resolveContextDir(cwd);

  // 1. Look for PRODUCT.md (case-insensitive) in the resolved dir
  let productPath = firstExisting(contextDir, PRODUCT_NAMES);

  // 2. Legacy: if no PRODUCT.md but .impeccable.md exists at cwd root, rename
  //    it in place. We only migrate at the root — fallback dirs are read-only
  //    so we don't surprise users by mutating files under docs/ or .agents/.
  if (!productPath && contextDir === cwd) {
    const legacyPath = firstExisting(cwd, LEGACY_NAMES);
    if (legacyPath) {
      const newPath = path.join(cwd, 'PRODUCT.md');
      try {
        fs.renameSync(legacyPath, newPath);
        productPath = newPath;
        migrated = true;
      } catch {
        // Rename failed (permissions, etc.) — fall back to reading legacy in place
        productPath = legacyPath;
      }
    }
  }

  // 3. DESIGN.md (case-insensitive)
  const designPath = firstExisting(contextDir, DESIGN_NAMES);

  const product = productPath ? safeRead(productPath) : null;
  const design = designPath ? safeRead(designPath) : null;

  return {
    hasProduct: !!product,
    product,
    productPath: productPath ? path.relative(cwd, productPath) : null,
    hasDesign: !!design,
    design,
    designPath: designPath ? path.relative(cwd, designPath) : null,
    migrated,
    contextDir,
  };
}

function firstExisting(dir, names) {
  for (const name of names) {
    const abs = path.join(dir, name);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

// ---------------------------------------------------------------------------
// CLI mode — print the context as JSON
// ---------------------------------------------------------------------------

function cli() {
  const result = loadContext(process.cwd());
  console.log(JSON.stringify(result, null, 2));
}

const _running = process.argv[1];
if (_running?.endsWith('load-context.mjs') || _running?.endsWith('load-context.mjs/')) {
  cli();
}
