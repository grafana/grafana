/**
 * Scaffolding CLI for new Critical User Journeys.
 *
 * Generates the wiring file, test file, optional smoke driver, registry
 * entry, bootstrap import, and (with --with-smoke) the smoke runner import.
 *
 * Usage:
 *   yarn cuj:new <type> [--owner <name>] [--description <text>]
 *                       [--timeout-ms <n>] [--parent <type>]...
 *                       [--with-smoke] [--dry-run]
 *
 *   <type> is snake_case, e.g. alert_rule_save. Files are derived as
 *   camelCase, e.g. alertRuleSave.ts.
 *
 * Read public/app/core/journeys/AGENTS.md for the full recipe and what to
 * fill into the generated TODOs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// --------------------------------------------------------------------------
// Paths
// --------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const JOURNEYS_DIR = path.join(REPO_ROOT, 'public', 'app', 'core', 'journeys');
const REGISTRY_PATH = path.join(REPO_ROOT, 'public', 'app', 'core', 'services', 'journeyRegistry.ts');
const APP_TS_PATH = path.join(REPO_ROOT, 'public', 'app', 'app.ts');
const SMOKE_RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'cuj-smoke.ts');

// --------------------------------------------------------------------------
// CLI parsing
// --------------------------------------------------------------------------

interface Args {
  type: string;
  owner: string;
  description: string;
  timeoutMs: number;
  parents: string[];
  withSmoke: boolean;
  dryRun: boolean;
}

function printHelp(): void {
  console.log(
    [
      'cuj-new: scaffold a new Critical User Journey.',
      '',
      'Usage:',
      '  yarn cuj:new <type> [options]',
      '',
      '  <type>                 snake_case journey type (e.g. alert_rule_save).',
      '                         must match /^[a-z][a-z0-9_]*$/',
      '',
      'Options:',
      '  --owner <name>         squad that owns this journey (default: grafana-dashboards)',
      '  --description <text>   one-line description (default: TODO placeholder)',
      '  --timeout-ms <n>       journey timeout in ms (default: 60000)',
      '  --parent <type>        repeatable; nest under parent journey type',
      '  --with-smoke           also scaffold a Playwright smoke driver',
      '  --dry-run              print planned changes without writing anything',
      '  -h, --help             show this help',
      '',
      'Generates:',
      '  public/app/core/journeys/<camelCase>.ts',
      '  public/app/core/journeys/<camelCase>.test.ts',
      '  public/app/core/journeys/<camelCase>.smoke.ts   (only with --with-smoke)',
      'Modifies:',
      '  public/app/core/services/journeyRegistry.ts',
      '  public/app/app.ts',
      '  scripts/cuj-smoke.ts                             (only with --with-smoke)',
    ].join('\n')
  );
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    type: '',
    owner: 'grafana-dashboards',
    description: 'TODO: describe this journey',
    timeoutMs: 60_000,
    parents: [],
    withSmoke: false,
    dryRun: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      case '--owner':
        args.owner = required(argv, ++i, '--owner');
        break;
      case '--description':
        args.description = required(argv, ++i, '--description');
        break;
      case '--timeout-ms': {
        const raw = required(argv, ++i, '--timeout-ms');
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`--timeout-ms must be a positive number, got "${raw}"`);
        }
        args.timeoutMs = Math.floor(n);
        break;
      }
      case '--parent':
        args.parents.push(required(argv, ++i, '--parent'));
        break;
      case '--with-smoke':
        args.withSmoke = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        if (a.startsWith('-')) {
          throw new Error(`unknown flag "${a}". Run with --help for usage.`);
        }
        positional.push(a);
    }
  }

  if (positional.length === 0) {
    throw new Error(`missing positional <type>. Run with --help for usage.`);
  }
  if (positional.length > 1) {
    throw new Error(`unexpected extra positional arg(s): ${positional.slice(1).join(', ')}`);
  }
  args.type = positional[0];

  if (!/^[a-z][a-z0-9_]*$/.test(args.type)) {
    throw new Error(`invalid <type> "${args.type}". Must match /^[a-z][a-z0-9_]*$/ (snake_case).`);
  }

  return args;
}

function required(argv: string[], i: number, name: string): string {
  const v = argv[i];
  if (v === undefined) {
    throw new Error(`flag ${name} requires a value`);
  }
  return v;
}

// --------------------------------------------------------------------------
// Naming
// --------------------------------------------------------------------------

function toCamelCase(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

// --------------------------------------------------------------------------
// Templates
// --------------------------------------------------------------------------

function wiringTemplate(type: string, description: string): string {
  return `import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: ${type}
 *
 * ${description}
 *
 * Start triggers:
 *   - TODO: which interaction(s) start this journey?
 *
 * Mid-journey:
 *   - TODO: list any duration steps and point-in-time events
 *
 * End conditions:
 *   - success: TODO which interaction
 *   - discarded: TODO which interaction
 *   - timeout: configured in journeyRegistry.ts
 */

registerJourneyTriggers('${type}', (tracker) => {
  // TODO: replace 'todo_start_event' with the real start interaction.
  return onInteraction('todo_start_event', () => {
    if (!tracker.getActiveJourney('${type}')) {
      tracker.startJourney('${type}', {
        attributes: {
          // TODO: any start-time attributes
        },
      });
    }
  });
});

onJourneyInstance('${type}', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // TODO: subscribe to mid-journey interactions via add(onInteraction(...)).
  // Use handle.recordEvent for point-in-time events, handle.startStep for
  // duration steps, and handle.setAttributes to enrich the journey.
  add(
    onInteraction('todo_mid_event', (props) => {
      handle.setAttributes({
        // TODO: enrich the journey from props
        example: str(props.example),
      });
    })
  );

  // TODO: end conditions. Replace with the real success / discarded events.
  add(
    onInteraction('todo_success_event', () => {
      handle.end('success');
    })
  );

  add(
    onInteraction('todo_discarded_event', () => {
      handle.end('discarded');
    })
  );

  return cleanup;
});
`;
}

function testTemplate(type: string, camel: string): string {
  return `import type { JourneyHandle, JourneyTracker } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/JourneyRegistryImpl';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockTracker,
  setupJourneyTest,
} from './__test-utils__/journeyTestHarness';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    onInteraction: (name: string, callback: (properties: Record<string, unknown>) => void) => {
      let set = interactionCallbacks.get(name);
      if (!set) {
        set = new Set();
        interactionCallbacks.set(name, set);
      }
      set.add(callback);
      return () => {
        set!.delete(callback);
        if (set!.size === 0) {
          interactionCallbacks.delete(name);
        }
      };
    },
  };
});

describe('${camel} journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('${type}');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./${camel}');
    });
  }

  it('should start journey on todo_start_event', () => {
    loadWiring();

    simulateInteraction('todo_start_event', {});

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith('${type}', expect.any(Object));
  });

  // TODO: add tests for each mid-journey event and end condition.
});
`;
}

function smokeTemplate(type: string, camel: string): string {
  const driverConst = `${camel}Driver`;
  return `import { type Page } from '@playwright/test';

import { type JourneyDriver } from './__smoke__/types.ts';

// TODO: list the scenarios this driver supports. Each becomes a value the
// orchestrator can pin via --scenario.
const ${camel.toUpperCase()}_SCENARIOS = ['todo-success', 'todo-discarded'] as const;

async function runSuccess(page: Page): Promise<void> {
  // TODO: drive the page through the success path of '${type}'.
  void page;
  throw new Error('${type} smoke: todo-success scenario not implemented');
}

async function runDiscarded(page: Page): Promise<void> {
  // TODO: drive the page through the discarded path of '${type}'.
  void page;
  throw new Error('${type} smoke: todo-discarded scenario not implemented');
}

export const ${driverConst}: JourneyDriver = {
  type: '${type}',
  scenarios: ${camel.toUpperCase()}_SCENARIOS,
  async runScenario(page: Page, scenario: string): Promise<void> {
    switch (scenario) {
      case 'todo-success':
        return runSuccess(page);
      case 'todo-discarded':
        return runDiscarded(page);
      default:
        throw new Error(\`${type}: unknown scenario "\${scenario}"\`);
    }
  },
};
`;
}

// --------------------------------------------------------------------------
// File-modification helpers
// --------------------------------------------------------------------------

interface PlannedWrite {
  path: string;
  kind: 'create' | 'modify';
  contents: string;
}

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`expected file does not exist: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function ensureNotExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    throw new Error(`refusing to overwrite existing file: ${filePath}`);
  }
}

function buildRegistryEntry(args: Args): string {
  const lines = [
    '  {',
    `    type: '${args.type}',`,
    `    description: '${escapeSingleQuoted(args.description)}',`,
    `    owner: '${escapeSingleQuoted(args.owner)}',`,
    `    timeoutMs: ${args.timeoutMs},`,
  ];
  if (args.parents.length > 0) {
    const inner = args.parents.map((p) => `'${escapeSingleQuoted(p)}'`).join(', ');
    lines.push(`    parents: [${inner}],`);
  }
  lines.push('  },');
  return lines.join('\n');
}

function escapeSingleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Substring check, not regex, because the type is user-supplied and CodeQL
// flags regex construction from user input (the validator at parseArgs
// already restricts `args.type` to /^[a-z][a-z0-9_]*$/, but a textual check
// avoids the warning entirely).
function registryHasJourneyType(content: string, type: string): boolean {
  return content.includes(`type: '${type}'`) || content.includes(`type: "${type}"`);
}

function modifyRegistry(args: Args): PlannedWrite {
  const original = readFile(REGISTRY_PATH);

  if (registryHasJourneyType(original, args.type)) {
    throw new Error(`journey type '${args.type}' already exists in journeyRegistry.ts`);
  }

  // Find the closing '];' of the JOURNEY_REGISTRY array.
  const arrayStart = original.indexOf('JOURNEY_REGISTRY: JourneyMeta[] = [');
  if (arrayStart === -1) {
    throw new Error(`could not locate "JOURNEY_REGISTRY: JourneyMeta[] = [" in ${REGISTRY_PATH}`);
  }
  const closeIdx = original.indexOf('];', arrayStart);
  if (closeIdx === -1) {
    throw new Error(`could not locate closing "];" of JOURNEY_REGISTRY in ${REGISTRY_PATH}`);
  }

  const entry = buildRegistryEntry(args) + '\n';
  const next = original.slice(0, closeIdx) + entry + original.slice(closeIdx);
  return { path: REGISTRY_PATH, kind: 'modify', contents: next };
}

function modifyAppTs(camel: string): PlannedWrite {
  const original = readFile(APP_TS_PATH);

  // Match the journey-import Promise.all([...]) with one or more imports.
  // Tolerates single-line or multi-line formatting.
  const re = /await Promise\.all\(\[([\s\S]*?)\]\);(\s*\/\/[^\n]*journey)?/;
  const match = original.match(re);
  if (!match) {
    throw new Error(
      `could not locate the journey-import "await Promise.all([...])" block in ${APP_TS_PATH}. ` +
        `Expected near the JOURNEY_REGISTRY init.`
    );
  }

  const inside = match[1];
  const importPath = `./core/journeys/${camel}`;
  if (inside.includes(importPath)) {
    throw new Error(`app.ts already imports ${importPath}`);
  }

  // Strategy: split existing imports, append, re-emit on one line if it fits,
  // otherwise multi-line.
  const items = inside
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  items.push(`import('${importPath}')`);

  const oneLine = `await Promise.all([${items.join(', ')}]);`;
  // Heuristic: if the original was single-line and stays under 120 chars, keep
  // it single-line; otherwise switch to multi-line indented like the rest of
  // the file (8 spaces inside Promise.all per the surrounding block).
  let replacement: string;
  const wasSingleLine = !inside.includes('\n');
  if (wasSingleLine && oneLine.length <= 120) {
    replacement = oneLine;
  } else {
    const indent = '          ';
    replacement = ['await Promise.all([', ...items.map((it) => `${indent}${it},`), '        ]);'].join('\n');
  }

  const next = original.slice(0, match.index!) + replacement + original.slice(match.index! + match[0].length);
  return { path: APP_TS_PATH, kind: 'modify', contents: next };
}

function modifySmokeRunner(type: string, camel: string): PlannedWrite {
  const original = readFile(SMOKE_RUNNER_PATH);

  const driverConst = `${camel}Driver`;
  const importLine = `import { ${driverConst} } from '../public/app/core/journeys/${camel}.smoke.ts';`;
  if (original.includes(importLine)) {
    throw new Error(`scripts/cuj-smoke.ts already imports ${driverConst}`);
  }

  // 1. Insert the new import after the existing journey driver import.
  const importRe =
    /import \{ searchToResourceDriver \} from '\.\.\/public\/app\/core\/journeys\/searchToResource\.smoke\.ts';\n/;
  const importMatch = original.match(importRe);
  if (!importMatch) {
    // Fall back to inserting after any *.smoke.ts import.
    const fallbackRe =
      /(import \{[^}]+\} from '\.\.\/public\/app\/core\/journeys\/[^']+\.smoke\.ts';\n)(?![\s\S]*import \{[^}]+\} from '\.\.\/public\/app\/core\/journeys\/[^']+\.smoke\.ts';)/;
    const fbMatch = original.match(fallbackRe);
    if (!fbMatch) {
      throw new Error(`could not locate a smoke-driver import in ${SMOKE_RUNNER_PATH}`);
    }
    const insertAt = fbMatch.index! + fbMatch[0].length;
    let next = original.slice(0, insertAt) + importLine + '\n' + original.slice(insertAt);
    next = insertDriverEntry(next, type, driverConst);
    return { path: SMOKE_RUNNER_PATH, kind: 'modify', contents: next };
  }

  const insertAt = importMatch.index! + importMatch[0].length;
  let next = original.slice(0, insertAt) + importLine + '\n' + original.slice(insertAt);
  next = insertDriverEntry(next, type, driverConst);
  return { path: SMOKE_RUNNER_PATH, kind: 'modify', contents: next };
}

function insertDriverEntry(src: string, type: string, driverConst: string): string {
  // Find the DRIVERS object literal and insert a new key before its closing brace.
  const driversRe = /const DRIVERS: Record<string, JourneyDriver> = \{([\s\S]*?)\};/;
  const m = src.match(driversRe);
  if (!m) {
    throw new Error(
      `could not locate "const DRIVERS: Record<string, JourneyDriver> = { ... }" in ${SMOKE_RUNNER_PATH}`
    );
  }

  const inner = m[1];
  if (inner.includes(driverConst)) {
    return src; // already added (defensive)
  }

  // Insert before the final newline of the inner block, matching existing 2-space indent.
  const newEntry = `  [${driverConst}.type]: ${driverConst},\n`;
  const trimmed = inner.replace(/\n$/, '');
  const newInner = trimmed + '\n' + newEntry;
  const replacement = `const DRIVERS: Record<string, JourneyDriver> = {${newInner}};`;
  return src.slice(0, m.index!) + replacement + src.slice(m.index! + m[0].length);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function checkJourneyDoesNotExist(args: Args, camel: string): void {
  const registry = readFile(REGISTRY_PATH);
  if (registryHasJourneyType(registry, args.type)) {
    throw new Error(`journey type '${args.type}' already exists in journeyRegistry.ts`);
  }
  const wiringPath = path.join(JOURNEYS_DIR, `${camel}.ts`);
  if (fs.existsSync(wiringPath)) {
    throw new Error(`journey wiring file already exists: ${wiringPath}`);
  }
}

function plan(args: Args): PlannedWrite[] {
  const camel = toCamelCase(args.type);
  checkJourneyDoesNotExist(args, camel);

  const writes: PlannedWrite[] = [];

  const wiringPath = path.join(JOURNEYS_DIR, `${camel}.ts`);
  ensureNotExists(wiringPath);
  writes.push({ path: wiringPath, kind: 'create', contents: wiringTemplate(args.type, args.description) });

  const testPath = path.join(JOURNEYS_DIR, `${camel}.test.ts`);
  ensureNotExists(testPath);
  writes.push({ path: testPath, kind: 'create', contents: testTemplate(args.type, camel) });

  if (args.withSmoke) {
    const smokePath = path.join(JOURNEYS_DIR, `${camel}.smoke.ts`);
    ensureNotExists(smokePath);
    writes.push({ path: smokePath, kind: 'create', contents: smokeTemplate(args.type, camel) });
  }

  writes.push(modifyRegistry(args));
  writes.push(modifyAppTs(camel));
  if (args.withSmoke) {
    writes.push(modifySmokeRunner(args.type, camel));
  }

  return writes;
}

function applyWrites(writes: PlannedWrite[]): void {
  for (const w of writes) {
    fs.mkdirSync(path.dirname(w.path), { recursive: true });
    fs.writeFileSync(w.path, w.contents, 'utf8');
  }
}

function relPath(p: string): string {
  return path.relative(REPO_ROOT, p);
}

function main(): void {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`error: ${msg}`);
    process.exit(2);
  }

  let writes: PlannedWrite[];
  try {
    writes = plan(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`error: ${msg}`);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(`[dry-run] would scaffold journey '${args.type}' (${toCamelCase(args.type)})`);
    for (const w of writes) {
      console.log(`  ${w.kind.padEnd(6)} ${relPath(w.path)}`);
    }
    console.log('\n[dry-run] no files written.');
    return;
  }

  try {
    applyWrites(writes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`error while writing files: ${msg}`);
    process.exit(1);
  }

  const camel = toCamelCase(args.type);
  console.log(`scaffolded journey '${args.type}' (${camel})`);
  for (const w of writes) {
    console.log(`  ${w.kind.padEnd(6)} ${relPath(w.path)}`);
  }
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Fill in the TODOs in public/app/core/journeys/${camel}.ts`);
  console.log(`     (start trigger, mid-journey events, end conditions).`);
  console.log(`  2. Replace the placeholder test in public/app/core/journeys/${camel}.test.ts`);
  console.log(`     with cases for every end condition + at least one negative case.`);
  if (args.withSmoke) {
    console.log(`  3. Implement the smoke scenarios in public/app/core/journeys/${camel}.smoke.ts.`);
  }
  console.log(`  ${args.withSmoke ? '4' : '3'}. Run: yarn typecheck && yarn jest --no-watch ${camel}.test.ts`);
  if (args.withSmoke) {
    console.log(`  5. Run: yarn typecheck:smoke`);
  }
  console.log('');
  console.log('See public/app/core/journeys/AGENTS.md and journey-tracking.md for the full recipe.');
}

main();
