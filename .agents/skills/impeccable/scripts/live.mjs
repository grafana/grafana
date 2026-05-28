/**
 * CLI entry point: prepare everything needed to enter the live variant poll loop.
 *
 * Does (all in one command):
 *   1. Check .impeccable/live/config.json (returns config_missing if first-ever run)
 *   2. Start the live server in the background (or reuse a running one)
 *   3. Inject the browser script tag into the project's entry file
 *   4. Read PRODUCT.md / DESIGN.md for project context
 *   5. Print a single JSON blob with everything the agent needs
 *
 * After this, the agent's only remaining steps are:
 *   - Open the project's live dev/preview URL in the browser (optional, if browser automation exists)—not `serverPort`; that port is the Impeccable helper for /live.js and /poll
 *   - Enter the poll loop: `node live-poll.mjs`
 *
 * Usage:
 *   node live.mjs                   # Prepare everything, print JSON, exit
 *   node live.mjs --help
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContext } from './load-context.mjs';
import { resolveFiles } from './live-inject.mjs';
import { readLiveServerInfo } from './impeccable-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function liveCli() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node live.mjs

Prepare everything for live variant mode in a single command:
  - Checks .impeccable/live/config.json (required, created once per project)
  - Starts (or reuses) the live server in the background
  - Injects the browser script tag
  - Reads PRODUCT.md / DESIGN.md for project context

On success, prints a JSON blob with:
  { ok, serverPort, serverToken, pageFile, hasContext, context }

On config_missing, prints:
  { ok: false, error: "config_missing", configPath, hint }

The agent should then:
  1. If config_missing, create the config and re-run this script
  2. Optionally open the project's dev/preview URL in the browser (see reference/live.md—not serverPort)
  3. Enter the poll loop: node live-poll.mjs`);
    process.exit(0);
  }

  // 1. Check config (fail fast if missing — no point starting anything else)
  const checkOut = runScript('live-inject.mjs', ['--check']);
  const checkResult = safeParse(checkOut);
  if (!checkResult || !checkResult.ok) {
    console.log(JSON.stringify(checkResult || { ok: false, error: 'check_failed', raw: checkOut }));
    process.exit(0);
  }

  // 2. Start server (or reuse existing)
  const serverInfo = ensureServerRunning();
  if (!serverInfo) {
    console.log(JSON.stringify({ ok: false, error: 'server_start_failed' }));
    process.exit(1);
  }

  // 3. Inject the script tag at the current port
  const injectOut = runScript('live-inject.mjs', ['--port', String(serverInfo.port)]);
  const injectResult = safeParse(injectOut);
  if (!injectResult || !injectResult.ok) {
    console.log(JSON.stringify({
      ok: false,
      error: 'inject_failed',
      detail: injectResult || injectOut,
      serverPort: serverInfo.port,
    }));
    process.exit(1);
  }

  // 4. Load PRODUCT.md + DESIGN.md context (auto-migrates legacy .impeccable.md)
  const ctx = loadContext(process.cwd());

  // 5. Compute drift-heal: compare resolved inject targets against the
  //    project's HTML files. Orphans are HTML files not covered by config.
  //    Warning only — the agent decides whether to act.
  const resolvedFiles = resolveFiles(process.cwd(), checkResult.config);
  const drift = scanForDrift(process.cwd(), resolvedFiles, checkResult.config);

  // 6. Emit everything the agent needs
  console.log(JSON.stringify({
    ok: true,
    serverPort: serverInfo.port,
    serverToken: serverInfo.token,
    pageFiles: resolvedFiles,
    configDrift: drift,
    hasProduct: ctx.hasProduct,
    product: ctx.product,
    productPath: ctx.productPath,
    hasDesign: ctx.hasDesign,
    design: ctx.design,
    designPath: ctx.designPath,
    migrated: ctx.migrated,
  }, null, 2));
}

/**
 * Drift-heal scan. Walks the project for HTML files under common
 * page-source directories (public/, src/, app/, pages/) and reports any
 * that aren't covered by the resolved inject targets. This is purely
 * advisory — the agent can ignore it, or suggest the user add the
 * orphans to config.files.
 *
 * Skipped if config.files already contains at least one glob pattern
 * covering everything in practice (signaled by the orphan count being 0).
 */
function scanForDrift(rootDir, resolvedFiles, config) {
  const SCAN_ROOTS = ['public', 'src', 'app', 'pages'];
  const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro',
    '.turbo', '.vercel', '.cache', 'coverage', 'dist', 'build',
  ]);

  const resolvedSet = new Set(resolvedFiles.map((f) => f.split(path.sep).join('/')));

  // Files matching the user's `exclude` globs are intentional omissions,
  // not drift. Compile them to regexes so the orphan list stays signal.
  const userExcludeRegexes = (Array.isArray(config.exclude) ? config.exclude : [])
    .map((p) => globToRegex(p));
  const isUserExcluded = (rel) => userExcludeRegexes.some((re) => re.test(rel));

  const orphans = [];

  const walk = (dir, relBase) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        walk(path.join(dir, e.name), rel);
      } else if (e.isFile() && e.name.endsWith('.html')) {
        if (resolvedSet.has(rel)) continue;
        if (isUserExcluded(rel)) continue;
        orphans.push(rel);
      }
    }
  };

  for (const root of SCAN_ROOTS) {
    const abs = path.join(rootDir, root);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      walk(abs, root);
    }
  }

  if (orphans.length === 0) return null;
  const capped = orphans.slice(0, 20);
  return {
    orphans: capped,
    orphanCount: orphans.length,
    hint: `${orphans.length} HTML file(s) exist but aren't in config.files. Consider adding them, or use a glob pattern like "public/**/*.html".`,
  };
}

/**
 * Same glob-to-regex mapping used by live-inject.mjs. Kept inline here
 * to avoid a circular import (live-inject.mjs already imports nothing
 * from live.mjs). The two must stay in sync.
 */
function globToRegex(pattern) {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 3; }
        else { re += '.*'; i += 2; }
      } else {
        re += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      re += '[^/]';
      i += 1;
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      re += '\\' + c;
      i += 1;
    } else {
      re += c;
      i += 1;
    }
  }
  return new RegExp('^' + re + '$');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runScript(name, args) {
  const scriptPath = path.join(__dirname, name);
  const cmd = `node "${scriptPath}" ${args.map(a => `"${a}"`).join(' ')}`;
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 15_000 });
  } catch (err) {
    // execSync throws on non-zero exit; return stdout if any
    return err.stdout || err.message || '';
  }
}

function safeParse(out) {
  try { return JSON.parse(String(out).trim()); } catch { return null; }
}

/**
 * Return { pid, port, token } for the running live server, starting one if needed.
 */
function ensureServerRunning() {
  // Try to reuse an existing server
  try {
    const existing = readLiveServerInfo(process.cwd())?.info;
    if (existing && existing.pid) {
      try {
        process.kill(existing.pid, 0); // throws if dead
        return existing;
      } catch { /* stale PID file — the server script will clean it up */ }
    }
  } catch { /* no PID file */ }

  // Start a new server
  const out = runScript('live-server.mjs', ['--background']);
  return safeParse(out);
}

// ---------------------------------------------------------------------------
// Auto-execute
// ---------------------------------------------------------------------------

const _running = process.argv[1];
if (_running?.endsWith('live.mjs') || _running?.endsWith('live.mjs/')) {
  liveCli();
}
