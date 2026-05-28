/**
 * Scan a project tree for Content-Security-Policy signals and classify the
 * shape so the agent knows which patch template to propose.
 *
 * Used at first-time `live.mjs` setup. Mechanical (grep-based) — no network,
 * no dev server, no JS evaluation. The classification drives a user-facing
 * consent prompt; the agent does the actual patch writing.
 *
 * Shapes are named by patch mechanism, not framework origin:
 *   - "append-arrays":  CSP defined as structured directive arrays. Patch
 *                       appends a dev-only localhost entry. Covers:
 *                         - Monorepo helpers with additional*Src options
 *                           (e.g. createBaseNextConfig for Next)
 *                         - SvelteKit kit.csp.directives
 *                         - nuxt-security module's contentSecurityPolicy
 *   - "append-string":  CSP built as a literal value string. Patch splices
 *                       a dev-only token into script-src and connect-src.
 *                       Covers:
 *                         - Inline Next.js headers() with CSP string
 *                         - Nuxt routeRules / nitro.routeRules CSP headers
 *   - "middleware":     CSP set dynamically in middleware.{ts,js}.
 *                       Detected but not auto-patched in v1.
 *   - "meta-tag":       <meta http-equiv="Content-Security-Policy"> in
 *                       layout files. Detected but not auto-patched in v1.
 *   - null:             no CSP signals found; no patch needed.
 */

import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.svelte-kit',
  '.nuxt',
  '.astro',
  'dist',
  'build',
  'out',
  '.vercel',
]);

const SCAN_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx']);
const LAYOUT_EXTS = new Set(['.tsx', '.jsx', '.astro', '.vue', '.svelte', '.html']);
const MAX_DEPTH = 6;
const MAX_READ_BYTES = 64 * 1024;

// append-arrays signals: CSP expressed as structured directive arrays
const MONOREPO_HELPER_SIGNALS = [
  /\bbuildCSPConfig\b/,
  /\bbuildSecurityHeaders\b/,
  /\badditionalScriptSrc\b/,
  /\badditionalConnectSrc\b/,
  /\bcreateBaseNextConfig\b/,
];
const SVELTEKIT_CSP_SIGNALS = [
  /\bkit\s*:/,
  /\bcsp\s*:/,
  /\bdirectives\s*:/,
];
const NUXT_SECURITY_SIGNALS = [
  /['"]nuxt-security['"]/,
  /\bcontentSecurityPolicy\b/,
];

// append-string signals: CSP written as a literal value string
const INLINE_HEADER_SIGNALS = [
  /["']Content-Security-Policy["']/i,
  /\bscript-src\b/,
  /\bconnect-src\b/,
];
const NUXT_ROUTE_RULES_SIGNALS = [
  /\brouteRules\b/,
  /Content-Security-Policy/i,
  /\bscript-src\b/,
];

const MIDDLEWARE_HINT = /headers\.set\(\s*["']Content-Security-Policy["']/i;
const META_TAG_HINT = /http-equiv\s*=\s*["']Content-Security-Policy["']/i;

/**
 * @param {string} cwd Project root.
 * @returns {{ shape: string|null, signals: string[] }}
 */
export function detectCsp(cwd = process.cwd()) {
  const hits = { appendArrays: [], appendString: [], middleware: [], metaTag: [] };

  walk(cwd, cwd, 0, (absPath, relPath, body) => {
    const ext = path.extname(absPath);
    const base = path.basename(absPath).toLowerCase();
    const isConfig = (name) =>
      new RegExp('(^|/)' + name + '\\.config\\.').test(relPath);

    // === append-arrays candidates ===

    // Monorepo CSP helper: packages/*/src/.../(config|security)/*
    if (SCAN_EXTS.has(ext) &&
        /packages\/[^/]+\/src\/.*(config|next-config|security)/.test(relPath) &&
        MONOREPO_HELPER_SIGNALS.some((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // SvelteKit kit.csp.directives
    if (SCAN_EXTS.has(ext) && isConfig('svelte') &&
        SVELTEKIT_CSP_SIGNALS.every((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // Nuxt nuxt-security module
    if (SCAN_EXTS.has(ext) && isConfig('nuxt') &&
        NUXT_SECURITY_SIGNALS.every((re) => re.test(body))) {
      hits.appendArrays.push(relPath);
      return;
    }

    // === append-string candidates ===

    // Inline headers in Next/Nuxt/SvelteKit/Astro/Vite config
    if (SCAN_EXTS.has(ext) &&
        /(^|\/)(next|nuxt|vite|astro|svelte)\.config\./.test(relPath) &&
        INLINE_HEADER_SIGNALS.every((re) => re.test(body))) {
      // Nuxt routeRules is a sub-shape of append-string; we already covered
      // nuxt-security above via return, so any remaining Nuxt CSP match here
      // is a route-rules / inline-headers case. Either way, same patch
      // mechanism.
      hits.appendString.push(relPath);
      return;
    }

    // === detect-only shapes ===

    if ((base === 'middleware.ts' || base === 'middleware.js' || base === 'middleware.mjs') &&
        MIDDLEWARE_HINT.test(body)) {
      hits.middleware.push(relPath);
    }

    if (LAYOUT_EXTS.has(ext) && META_TAG_HINT.test(body)) {
      hits.metaTag.push(relPath);
    }
  });

  // Priority: append-arrays > append-string > middleware > meta-tag.
  // Structured patches are safer than string splices; runtime and HTML
  // injection patches are less reliable and v1 doesn't auto-apply them.
  if (hits.appendArrays.length > 0) {
    return { shape: 'append-arrays', signals: hits.appendArrays };
  }
  if (hits.appendString.length > 0) {
    return { shape: 'append-string', signals: hits.appendString };
  }
  if (hits.middleware.length > 0) {
    return { shape: 'middleware', signals: hits.middleware };
  }
  if (hits.metaTag.length > 0) {
    return { shape: 'meta-tag', signals: hits.metaTag };
  }
  return { shape: null, signals: [] };
}

function walk(root, dir, depth, visit) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(root, abs, depth + 1, visit);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!SCAN_EXTS.has(ext) && !LAYOUT_EXTS.has(ext)) continue;
    let body;
    try {
      const fd = fs.openSync(abs, 'r');
      try {
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const n = fs.readSync(fd, buf, 0, MAX_READ_BYTES, 0);
        body = buf.slice(0, n).toString('utf-8');
      } finally { fs.closeSync(fd); }
    } catch { continue; }
    visit(abs, path.relative(root, abs), body);
  }
}

// CLI mode
const _running = process.argv[1];
if (_running?.endsWith('detect-csp.mjs') || _running?.endsWith('detect-csp.mjs/')) {
  const result = detectCsp(process.cwd());
  console.log(JSON.stringify(result, null, 2));
}
