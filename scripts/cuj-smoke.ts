/**
 * Local smoke runner for Critical User Journeys.
 *
 * Drives a real browser through one or more journeys N times and reports the
 * outcome histogram. Each run produces real Faro/OTel telemetry against
 * whatever collector the local Grafana is wired to (see conf/custom.ini).
 *
 * Usage:
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 20
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 5 --headed
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 10 --scenario discarded
 *   node --experimental-strip-types scripts/cuj-smoke.ts --journeys search_to_resource
 *
 * Requires: local Grafana running on $GRAFANA_URL (default localhost:3000)
 * with the cujTracking feature toggle enabled and Faro tracing wired in
 * conf/custom.ini.
 *
 * Each journey owns its smoke driver under
 * public/app/core/journeys/<name>.smoke.ts (using shared helpers from
 * __smoke__/). Add a new journey to DRIVERS to expose it via --journeys.
 */

import { type Browser, type Page, chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type JourneyDriver } from '../public/app/core/journeys/__smoke__/types.ts';
import { searchToResourceDriver } from '../public/app/core/journeys/searchToResource.smoke.ts';

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

const GRAFANA_URL = process.env.GRAFANA_URL ?? 'http://localhost:3000';
const ADMIN_USER = process.env.GRAFANA_ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.GRAFANA_ADMIN_PASSWORD ?? 'admin';
// Standard storage state path used by the rest of the e2e suite (see playwright.config.ts).
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const STORAGE_STATE = path.join(REPO_ROOT, 'playwright', '.auth', `${ADMIN_USER}.json`);
const JOURNEY_TIMEOUT_MS = 30_000;

// Fixture dashboard for the existing-dashboard scenario. Created idempotently
// via the Grafana API at startup so the smoke runner is self-sufficient on a
// vanilla local install. Title kept in sync with searchToResource.smoke.ts.
const FIXTURE_UID = 'cuj-smoke-fixture';
const FIXTURE_TITLE = 'CUJ Smoke Fixture';

interface Args {
  runs: number;
  headless: boolean;
  scenario?: string;
  journeys: string[];
}

interface JourneyEnd {
  type: string;
  outcome: string;
  durationMs: number;
  attributes: Record<string, unknown>;
}

// Registry of journey drivers. Add new drivers here to expose them via --journeys.
const DRIVERS: Record<string, JourneyDriver> = {
  [searchToResourceDriver.type]: searchToResourceDriver,
};

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let runs = 10;
  let headless = true;
  let scenario: string | undefined;
  let journeys: string[] = ['search_to_resource'];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--runs':
      case '-n':
        runs = Number(args[++i]);
        break;
      case '--headed':
        headless = false;
        break;
      case '--scenario': {
        scenario = args[++i];
        break;
      }
      case '--journeys': {
        const raw = args[++i] ?? '';
        journeys = raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        break;
      }
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  if (!Number.isFinite(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer, got "${runs}"`);
  }

  if (journeys.length === 0) {
    throw new Error(`--journeys must list at least one journey type`);
  }
  const registered = Object.keys(DRIVERS);
  for (const j of journeys) {
    if (!DRIVERS[j]) {
      throw new Error(`unknown journey '${j}'. Registered: ${registered.join(', ')}`);
    }
  }

  if (scenario) {
    const supported = journeys.some((j) => DRIVERS[j].scenarios.includes(scenario as string));
    if (!supported) {
      const valid = journeys.flatMap((j) => DRIVERS[j].scenarios);
      throw new Error(
        `--scenario "${scenario}" is not supported by any selected journey. ` +
          `Valid for {${journeys.join(', ')}}: ${[...new Set(valid)].join(', ')}`
      );
    }
  }

  return { runs, headless, scenario, journeys };
}

function printHelp(): void {
  const journeyLines: string[] = ['Registered journeys:'];
  for (const [type, driver] of Object.entries(DRIVERS)) {
    journeyLines.push(`  ${type}`);
    journeyLines.push(`    scenarios: ${driver.scenarios.join(', ')}`);
  }

  console.log(
    [
      'cuj-smoke: drive Critical User Journeys N times against local Grafana',
      '',
      'Options:',
      '  --runs, -n <N>         number of runs (default 10)',
      '  --headed               run with visible browser',
      '  --journeys <list>      comma-separated journey types (default: search_to_resource)',
      '  --scenario <name>      pin a single scenario across selected journeys',
      '                         (must be supported by at least one selected journey)',
      '  -h, --help             show this help',
      '',
      ...journeyLines,
      '',
      'Env: GRAFANA_URL (default http://localhost:3000),',
      '     GRAFANA_ADMIN_USER (default admin) - matches the playwright authenticate project',
      '',
      `Auto-creates a fixture dashboard ("${FIXTURE_TITLE}") via the HTTP API on first run.`,
    ].join('\n')
  );
}

// --------------------------------------------------------------------------
// Login (one-time, cached as storage state)
// --------------------------------------------------------------------------

/**
 * Reuses the existing `authenticate` Playwright project from the e2e suite
 * (see playwright.config.ts and node_modules/@grafana/plugin-e2e/dist/auth/).
 * That project logs in admin, handles the force-change-password screen, and
 * writes storage state to playwright/.auth/admin.json — exactly the file we
 * point newContext at. No duplicate login implementation.
 */
function ensureLoggedIn(): void {
  if (fs.existsSync(STORAGE_STATE)) {
    return;
  }

  // The authenticate project depends on @grafana/e2e-selectors being built.
  // Build it if missing — first-run on a fresh worktree otherwise dies with
  // an opaque "Cannot find module" error from inside @grafana/plugin-e2e.
  const e2eSelectorsCjs = path.join(REPO_ROOT, 'node_modules', '@grafana', 'e2e-selectors', 'dist', 'cjs', 'index.cjs');
  if (!fs.existsSync(e2eSelectorsCjs)) {
    console.log(`[setup] building @grafana/e2e-selectors (one-time)`);
    const build = spawnSync('yarn', ['workspace', '@grafana/e2e-selectors', 'run', 'build'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (build.status !== 0) {
      throw new Error(`failed to build @grafana/e2e-selectors (exit ${build.status})`);
    }
  }

  console.log(`[setup] no storage state cached; running playwright authenticate project`);
  const result = spawnSync('yarn', ['playwright', 'test', '--project=authenticate', '--reporter=list'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, GRAFANA_URL },
  });
  if (result.status !== 0) {
    throw new Error(
      `playwright authenticate project failed (exit ${result.status}). ` +
        `Run \`GRAFANA_URL=${GRAFANA_URL} yarn playwright test --project=authenticate\` manually to see what's wrong.`
    );
  }
  if (!fs.existsSync(STORAGE_STATE)) {
    throw new Error(
      `authenticate project succeeded but storage state was not written to ${STORAGE_STATE}. ` +
        `Check GRAFANA_ADMIN_USER (current: ${ADMIN_USER}).`
    );
  }
  console.log(`[setup] storage state ready at ${STORAGE_STATE}`);
}

// --------------------------------------------------------------------------
// Fixture dashboard (idempotent)
// --------------------------------------------------------------------------

/**
 * Ensures the fixture dashboard exists so the existing-dashboard scenario has
 * a stable target on a vanilla local install. Uses the HTTP API with basic
 * auth — same admin credentials the authenticate project relies on.
 */
async function ensureFixtureDashboard(): Promise<void> {
  const authHeader = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

  const getRes = await fetch(`${GRAFANA_URL}/api/dashboards/uid/${FIXTURE_UID}`, {
    headers: { Authorization: authHeader },
  });

  if (getRes.status === 200) {
    console.log(`[setup] fixture dashboard "${FIXTURE_TITLE}" exists (${FIXTURE_UID})`);
    return;
  }

  if (getRes.status !== 404) {
    const body = await getRes.text();
    throw new Error(`GET /api/dashboards/uid/${FIXTURE_UID} returned ${getRes.status}: ${body}`);
  }

  const postRes = await fetch(`${GRAFANA_URL}/api/dashboards/db`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dashboard: { uid: FIXTURE_UID, title: FIXTURE_TITLE, panels: [], schemaVersion: 41 },
      overwrite: false,
    }),
  });

  if (!postRes.ok) {
    const body = await postRes.text();
    throw new Error(`POST /api/dashboards/db returned ${postRes.status}: ${body}`);
  }

  console.log(`[setup] created fixture dashboard "${FIXTURE_TITLE}" (${FIXTURE_UID})`);
}

// --------------------------------------------------------------------------
// Journey capture (mirrors the journeyRecorder pattern)
// --------------------------------------------------------------------------

/**
 * Resolves with the next journey-end log of the given type, or rejects on timeout.
 * Listens to console messages structured by createDebugLog:
 *   '[JourneyTracker] end', '<type> -> <outcome>', { journeyId, durationMs, ... }
 */
function nextJourneyEnd(page: Page, type: string): Promise<JourneyEnd> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`journey "${type}" did not end within ${JOURNEY_TIMEOUT_MS}ms`)),
      JOURNEY_TIMEOUT_MS
    );

    const listener = async (msg: import('@playwright/test').ConsoleMessage) => {
      if (!msg.text().startsWith('[JourneyTracker] end')) {
        return;
      }
      try {
        const args = await Promise.all(msg.args().map((a) => a.jsonValue()));
        const ctx = String(args[1] ?? '');
        const data = (args[2] ?? {}) as {
          journeyId?: string;
          durationMs?: number;
          attributes?: Record<string, unknown>;
        };
        const [endedType, outcome] = ctx.split(' -> ');
        if (endedType !== type) {
          return;
        }
        clearTimeout(timer);
        page.off('console', listener);
        resolve({
          type: endedType,
          outcome,
          durationMs: Number(data.durationMs ?? 0),
          attributes: data.attributes ?? {},
        });
      } catch {
        // ignore arg-resolution failures (e.g. closed page)
      }
    };
    page.on('console', listener);
  });
}

// --------------------------------------------------------------------------
// Selection helpers
// --------------------------------------------------------------------------

function pickJourney(journeys: string[]): JourneyDriver {
  const type = journeys[Math.floor(Math.random() * journeys.length)];
  return DRIVERS[type];
}

function pickScenario(driver: JourneyDriver, pinned?: string): string {
  if (pinned && driver.scenarios.includes(pinned)) {
    return pinned;
  }
  return driver.scenarios[Math.floor(Math.random() * driver.scenarios.length)];
}

// --------------------------------------------------------------------------
// Per-run lifecycle
// --------------------------------------------------------------------------

/**
 * Sentinel thrown when the cached storage state has gone stale and the page
 * redirected to /login (or /profile/password). The main loop catches this,
 * refreshes auth, and retries the iteration once.
 */
class SessionExpiredError extends Error {
  readonly landedAt: string;
  constructor(landedAt: string) {
    super(`session expired (landed at ${landedAt})`);
    this.name = 'SessionExpiredError';
    this.landedAt = landedAt;
  }
}

async function runOnce(browser: Browser, driver: JourneyDriver, scenario: string): Promise<JourneyEnd> {
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  await ctx.addInitScript(() => {
    // Enable journey debug logs so we can detect end events from console output.
    localStorage.setItem('grafana.debug.journeyTracker', 'true');
  });

  const page = await ctx.newPage();
  try {
    await page.goto(GRAFANA_URL);
    await page.waitForTimeout(200 + Math.random() * 600);
    await page.waitForLoadState('domcontentloaded');

    // If the cookie expired the page lands on /login or /profile/password.
    // Fail fast — otherwise openCommandPalette waits 30s for a button that
    // doesn't exist on those pages and the script appears to hang.
    const url = new URL(page.url());
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/profile/password')) {
      throw new SessionExpiredError(url.pathname);
    }

    const journeyP = nextJourneyEnd(page, driver.type);
    // Defuse the journey timeout: if runScenario throws before the journey
    // ends, nextJourneyEnd's 30s rejection would otherwise be unhandled and
    // crash the whole runner. Attach a no-op catch so the runtime is happy;
    // we still re-await journeyP below if runScenario succeeds.
    journeyP.catch(() => {});
    await driver.runScenario(page, scenario);
    const end = await journeyP;
    // Wait for Faro's batched transport to flush so OTel spans reach Tempo before the page is killed.
    await page.waitForTimeout(2000);
    return end;
  } finally {
    await ctx.close();
  }
}

function refreshAuth(): void {
  if (fs.existsSync(STORAGE_STATE)) {
    fs.unlinkSync(STORAGE_STATE);
  }
  ensureLoggedIn();
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

interface Summary {
  total: number;
  byOutcome: Map<string, number>;
  // journey -> scenario -> outcome -> count
  byJourney: Map<string, Map<string, Map<string, number>>>;
  totalDurationMs: number;
  failures: string[];
}

function printSummary(s: Summary): void {
  console.log('\n--- Summary ---');
  console.log(`Runs:         ${s.total}`);
  console.log(`Failures:     ${s.failures.length}`);
  if (s.byOutcome.size > 0) {
    const completed = [...s.byOutcome.values()].reduce((a, b) => a + b, 0);
    const avg = completed > 0 ? Math.round(s.totalDurationMs / completed) : 0;
    console.log(`Avg duration: ${avg}ms`);
    console.log('Outcomes:');
    for (const [o, n] of s.byOutcome) {
      console.log(`  ${o.padEnd(12)} ${n}`);
    }
  }
  console.log('Journey / scenario × outcome:');
  for (const [journey, scenarios] of s.byJourney) {
    for (const [scenario, outcomes] of scenarios) {
      const parts = [...outcomes.entries()].map(([o, n]) => `${o}=${n}`).join(' ');
      console.log(`  ${`${journey}/${scenario}`.padEnd(40)} ${parts}`);
    }
  }
  if (s.failures.length > 0) {
    console.log('\nFailures:');
    for (const f of s.failures) {
      console.log(`  - ${f}`);
    }
  }
}

function recordOutcome(summary: Summary, journey: string, scenario: string, outcome: string): void {
  summary.byOutcome.set(outcome, (summary.byOutcome.get(outcome) ?? 0) + 1);
  const perJourney = summary.byJourney.get(journey) ?? new Map<string, Map<string, number>>();
  const perScenario = perJourney.get(scenario) ?? new Map<string, number>();
  perScenario.set(outcome, (perScenario.get(outcome) ?? 0) + 1);
  perJourney.set(scenario, perScenario);
  summary.byJourney.set(journey, perJourney);
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(
    `[start] grafana=${GRAFANA_URL} runs=${args.runs} headless=${args.headless} ` +
      `journeys=${args.journeys.join(',')} scenario=${args.scenario ?? 'random'}`
  );

  const browser = await chromium.launch({ headless: args.headless });

  try {
    ensureLoggedIn();
    await ensureFixtureDashboard();

    const summary: Summary = {
      total: args.runs,
      byOutcome: new Map(),
      byJourney: new Map(),
      totalDurationMs: 0,
      failures: [],
    };

    for (let i = 1; i <= args.runs; i++) {
      const driver = pickJourney(args.journeys);
      const scenario = pickScenario(driver, args.scenario);
      const label = `${driver.type} / ${scenario}`;
      let end: JourneyEnd | undefined;
      try {
        end = await runOnce(browser, driver, scenario);
      } catch (err) {
        // One automatic retry on session expiry: refresh the storage state
        // and try the same scenario again so a stale cookie doesn't take
        // down a long N-run loop.
        if (err instanceof SessionExpiredError) {
          console.log(`[${i}/${args.runs}] ${label} session expired, refreshing auth and retrying`);
          refreshAuth();
          try {
            end = await runOnce(browser, driver, scenario);
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.log(`[${i}/${args.runs}] ${label} -> FAILED (after re-auth)  ${msg}`);
            summary.failures.push(`run ${i} (${label}, post-reauth): ${msg}`);
            continue;
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[${i}/${args.runs}] ${label} -> FAILED  ${msg}`);
          summary.failures.push(`run ${i} (${label}): ${msg}`);
          continue;
        }
      }

      const interactionMode = String(end.attributes['interactionMode'] ?? '-');
      console.log(
        `[${i}/${args.runs}] ${label} -> ${end.outcome.padEnd(10)} ${end.durationMs}ms  mode=${interactionMode}`
      );
      recordOutcome(summary, driver.type, scenario, end.outcome);
      summary.totalDurationMs += end.durationMs;
    }

    printSummary(summary);
    process.exitCode = summary.failures.length > 0 ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
