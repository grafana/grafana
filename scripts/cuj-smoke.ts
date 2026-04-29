/**
 * Local smoke runner for the search_to_resource Critical User Journey.
 *
 * Drives a real browser through the journey N times and reports the outcome
 * histogram. Each run produces real Faro/OTel telemetry against whatever
 * collector the local Grafana is wired to (see conf/custom.ini).
 *
 * Usage:
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 20
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 5 --headed
 *   node --experimental-strip-types scripts/cuj-smoke.ts --runs 10 --scenario discarded
 *
 * Requires: local Grafana running on $GRAFANA_URL (default localhost:3000)
 * with the cujTracking feature toggle enabled and Faro tracing wired in
 * conf/custom.ini.
 */

import { type Browser, type BrowserContext, type Page, chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mirror of selectors.components.NavToolbar.commandPaletteTrigger from
// packages/grafana-e2e-selectors. Hardcoded because this script runs as a plain
// Node process and the workspace package isn't built into node_modules.
const COMMAND_PALETTE_TRIGGER = 'data-testid Command palette trigger';

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

const GRAFANA_URL = process.env.GRAFANA_URL ?? 'http://localhost:3000';
const ADMIN_USER = process.env.GRAFANA_ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.GRAFANA_ADMIN_PASSWORD ?? 'admin';
// Standard storage state path used by the rest of the e2e suite (see playwright.config.ts).
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const STORAGE_STATE = path.join(REPO_ROOT, 'playwright', '.auth', `${ADMIN_USER}.json`);
const JOURNEY_TYPE = 'search_to_resource';
const JOURNEY_TIMEOUT_MS = 30_000;

// Fixture dashboard for the existing-dashboard scenario. Created idempotently
// via the Grafana API at startup so the smoke runner is self-sufficient on a
// vanilla local install.
const FIXTURE_UID = 'cuj-smoke-fixture';
const FIXTURE_TITLE = 'CUJ Smoke Fixture';

const SCENARIOS = ['new-dashboard', 'home-dashboard', 'import-dashboard', 'existing-dashboard', 'discarded'] as const;
type Scenario = (typeof SCENARIOS)[number];

// Per-scenario query variants. The runner picks one uniformly so the dashboard
// sees a realistic spread of query strings, casings, and lengths.
const QUERY_VARIANTS: Record<Scenario, string[]> = {
  'new-dashboard': ['new dashboard', 'new', 'create dashboard', 'new dash'],
  'home-dashboard': ['home', 'Home', 'home dashboard'],
  'import-dashboard': ['import', 'import dashboard'],
  'existing-dashboard': [FIXTURE_TITLE, 'CUJ Smoke', 'cuj smoke', 'smoke fixture'],
  discarded: ['something'],
};

type TypingPattern = 'burst' | 'normal' | 'thinking' | 'hunting';
type ActivationStyle = 'mouse' | 'keyboard-immediate' | 'keyboard-browse';

interface Args {
  runs: number;
  headless: boolean;
  scenario?: Scenario;
}

interface JourneyEnd {
  type: string;
  outcome: string;
  durationMs: number;
  attributes: Record<string, unknown>;
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let runs = 10;
  let headless = true;
  let scenario: Scenario | undefined;

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
        const s = args[++i];
        if (!SCENARIOS.includes(s as Scenario)) {
          throw new Error(`Unknown scenario "${s}". Valid: ${SCENARIOS.join(', ')}`);
        }
        scenario = s as Scenario;
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
  return { runs, headless, scenario };
}

function printHelp(): void {
  console.log(
    [
      'cuj-smoke: drive search_to_resource N times against local Grafana',
      '',
      'Options:',
      '  --runs, -n <N>         number of runs (default 10)',
      '  --headed               run with visible browser',
      `  --scenario <name>      pin a single scenario (default: uniform random)`,
      `                         valid: ${SCENARIOS.join(', ')}`,
      '  -h, --help             show this help',
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
// Scenario actions
// --------------------------------------------------------------------------

async function openCommandPalette(page: Page): Promise<void> {
  // Click the canonical trigger button (more reliable than the keyboard shortcut
  // across focus contexts). Selector imported from @grafana/e2e-selectors so we
  // pick up any future renames automatically.
  await page.getByTestId(COMMAND_PALETTE_TRIGGER).click();
  // KBar's search input renders with role="combobox" (see KBarSearch.tsx).
  await page.getByRole('combobox').waitFor({ state: 'visible', timeout: 5_000 });
}

function jitter(n: number): number {
  return Math.random() * n;
}

function pickTypingPattern(): TypingPattern {
  const r = Math.random();
  if (r < 0.3) return 'burst';
  if (r < 0.7) return 'normal';
  if (r < 0.9) return 'thinking';
  return 'hunting';
}

function pickActivationStyle(): ActivationStyle {
  const r = Math.random();
  if (r < 0.4) return 'mouse';
  if (r < 0.7) return 'keyboard-immediate';
  return 'keyboard-browse';
}

function pickQuery(scenario: Scenario): string {
  const variants = QUERY_VARIANTS[scenario];
  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Type a query with a human-shaped cadence so the search_query telemetry sees
 * realistic timing and the occasional typo+correction. Always pads with 700ms
 * after typing so the 500ms debounce flushes.
 */
async function humanType(page: Page, text: string, pattern: TypingPattern = pickTypingPattern()): Promise<void> {
  switch (pattern) {
    case 'burst':
      await page.keyboard.type(text, { delay: 40 + jitter(20) });
      break;
    case 'normal':
      await page.keyboard.type(text, { delay: 80 + jitter(40) });
      break;
    case 'thinking': {
      const split = Math.floor(text.length / 2);
      await page.keyboard.type(text.slice(0, split), { delay: 100 + jitter(80) });
      await page.waitForTimeout(500 + jitter(1000));
      await page.keyboard.type(text.slice(split), { delay: 100 + jitter(80) });
      break;
    }
    case 'hunting': {
      // Pick a non-terminal index to fat-finger, then correct.
      const idx = text.length > 1 ? Math.floor(Math.random() * (text.length - 1)) : 0;
      await page.keyboard.type(text.slice(0, idx), { delay: 80 + jitter(40) });
      const wrong = String.fromCodePoint((text.codePointAt(idx) ?? 97) + 1);
      await page.keyboard.type(wrong, { delay: 80 + jitter(40) });
      await page.waitForTimeout(150);
      await page.keyboard.press('Backspace');
      await page.keyboard.type(text.slice(idx), { delay: 80 + jitter(40) });
      break;
    }
  }
  await page.waitForTimeout(700);
}

async function activate(page: Page, style: ActivationStyle = pickActivationStyle()): Promise<void> {
  switch (style) {
    case 'mouse':
      await page.getByRole('option').first().click();
      return;
    case 'keyboard-immediate':
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      return;
    case 'keyboard-browse': {
      const downs = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < downs; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150 + jitter(200));
      }
      if (Math.random() < 0.3) {
        const ups = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < ups; i++) {
          await page.keyboard.press('ArrowUp');
          await page.waitForTimeout(150 + jitter(200));
        }
      }
      await page.keyboard.press('Enter');
      return;
    }
  }
}

/**
 * Search for a query, wait for the first result, activate it. Query, typing
 * cadence, and activation modality are all randomised so the dashboard sees
 * a realistic spread of telemetry shapes.
 */
async function searchAndActivate(page: Page, scenario: Scenario): Promise<void> {
  await openCommandPalette(page);
  await humanType(page, pickQuery(scenario));
  // kbar's dashboard search is async; allow up to 10s. If results never show
  // (or the query genuinely matches nothing), fall back to Escape so the
  // journey ends as `discarded` instead of leaving its 60s timeout running.
  const firstOption = page.getByRole('option').first();
  try {
    await firstOption.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    await page.keyboard.press('Escape');
    return;
  }
  await activate(page);
}

async function runDiscarded(page: Page): Promise<void> {
  const r = Math.random();
  if (r < 0.2) {
    // immediate-close: open and bail before typing anything.
    await openCommandPalette(page);
    await page.waitForTimeout(200 + jitter(800));
    await page.keyboard.press('Escape');
    return;
  }

  await openCommandPalette(page);
  const query = pickQuery('discarded');
  await humanType(page, query);

  if (r < 0.6) {
    // type-and-abandon
    await page.keyboard.press('Escape');
    return;
  }

  // type-clear-abandon: backspace through the query before escaping.
  for (let i = 0; i < query.length; i++) {
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(40 + jitter(60));
  }
  await page.waitForTimeout(300 + jitter(500));
  await page.keyboard.press('Escape');
}

async function runScenario(page: Page, scenario: Scenario): Promise<void> {
  switch (scenario) {
    case 'new-dashboard':
    case 'home-dashboard':
    case 'import-dashboard':
    case 'existing-dashboard':
      return searchAndActivate(page, scenario);
    case 'discarded':
      return runDiscarded(page);
  }
}

function pickScenario(pinned?: Scenario): Scenario {
  if (pinned) {
    return pinned;
  }
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
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

async function runOnce(browser: Browser, scenario: Scenario): Promise<JourneyEnd> {
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

    const journeyP = nextJourneyEnd(page, JOURNEY_TYPE);
    // Defuse the journey timeout: if runScenario throws before the journey
    // ends, nextJourneyEnd's 30s rejection would otherwise be unhandled and
    // crash the whole runner. Attach a no-op catch so the runtime is happy;
    // we still re-await journeyP below if runScenario succeeds.
    journeyP.catch(() => {});
    await runScenario(page, scenario);
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
  byScenario: Map<string, Map<string, number>>; // scenario -> outcome -> count
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
  console.log('Scenario × outcome:');
  for (const [scenario, outcomes] of s.byScenario) {
    const parts = [...outcomes.entries()].map(([o, n]) => `${o}=${n}`).join(' ');
    console.log(`  ${scenario.padEnd(14)} ${parts}`);
  }
  if (s.failures.length > 0) {
    console.log('\nFailures:');
    for (const f of s.failures) {
      console.log(`  - ${f}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(
    `[start] grafana=${GRAFANA_URL} runs=${args.runs} headless=${args.headless} scenario=${args.scenario ?? 'random'}`
  );

  const browser = await chromium.launch({ headless: args.headless });

  try {
    ensureLoggedIn();
    await ensureFixtureDashboard();

    const summary: Summary = {
      total: args.runs,
      byOutcome: new Map(),
      byScenario: new Map(),
      totalDurationMs: 0,
      failures: [],
    };

    for (let i = 1; i <= args.runs; i++) {
      const scenario = pickScenario(args.scenario);
      let end: JourneyEnd | undefined;
      try {
        end = await runOnce(browser, scenario);
      } catch (err) {
        // One automatic retry on session expiry: refresh the storage state
        // and try the same scenario again so a stale cookie doesn't take
        // down a long N-run loop.
        if (err instanceof SessionExpiredError) {
          console.log(`[${i}/${args.runs}] ${scenario.padEnd(14)} session expired, refreshing auth and retrying`);
          refreshAuth();
          try {
            end = await runOnce(browser, scenario);
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            console.log(`[${i}/${args.runs}] ${scenario.padEnd(14)} -> FAILED (after re-auth)  ${msg}`);
            summary.failures.push(`run ${i} (${scenario}, post-reauth): ${msg}`);
            continue;
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[${i}/${args.runs}] ${scenario.padEnd(14)} -> FAILED  ${msg}`);
          summary.failures.push(`run ${i} (${scenario}): ${msg}`);
          continue;
        }
      }

      const interactionMode = String(end.attributes['interactionMode'] ?? '-');
      console.log(
        `[${i}/${args.runs}] ${scenario.padEnd(14)} -> ${end.outcome.padEnd(10)} ${end.durationMs}ms  mode=${interactionMode}`
      );
      summary.byOutcome.set(end.outcome, (summary.byOutcome.get(end.outcome) ?? 0) + 1);
      const perScenario = summary.byScenario.get(scenario) ?? new Map();
      perScenario.set(end.outcome, (perScenario.get(end.outcome) ?? 0) + 1);
      summary.byScenario.set(scenario, perScenario);
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
