// Lists every test case owned by a codeowner as JSONL on stdout, one object per
// line: { file, startLine, endLine, name }. `file` is relative to the project
// root and startLine-endLine spans the whole test block so it can be read back
// for analysis. `name` is the full "describe > … > it" path. Test files are
// resolved with `jest --listTests` against jest.config.codeowner.js; no test
// bodies are executed.
//
// Usage: node ./scripts/codeowners-manifest/list-tests.mts '@grafana/dataviz-squad'

import { parse } from 'jest-editor-support';
import cp from 'node:child_process';
import path from 'node:path';

const JEST_BIN_PATH = 'node_modules/jest/bin/jest.js';
const JEST_CONFIG_PATH = 'jest.config.codeowner.js';
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/;

// jest-editor-support does not ship a location type for parsed nodes, so we
// describe only the shape we walk here.
interface ParsedLocation {
  line: number;
  column: number;
}

interface ParsedNode {
  type: string;
  name?: string;
  start?: ParsedLocation;
  end?: ParsedLocation;
  children?: ParsedNode[];
}

const codeownerName = process.argv[2];
if (!codeownerName) {
  process.stderr.write(`usage: node ${path.relative(process.cwd(), process.argv[1])} <codeowner>\n`);
  process.stderr.write(`example: node ${path.relative(process.cwd(), process.argv[1])} '@grafana/dataviz-squad'\n`);
  process.exit(1);
}

process.stderr.write(`Resolving test files owned by ${codeownerName} ...\n`);

const jest = cp.spawnSync(process.execPath, [JEST_BIN_PATH, `--config=${JEST_CONFIG_PATH}`, '--listTests'], {
  encoding: 'utf8',
  env: { ...process.env, CODEOWNER_NAME: codeownerName },
});

if (jest.error || jest.status !== 0) {
  process.stderr.write(jest.stdout ?? '');
  process.stderr.write(jest.stderr ?? '');
  process.stderr.write(`jest --listTests failed${jest.status != null ? ` with code ${jest.status}` : ''}\n`);
  process.exit(jest.status ?? 1);
}

// jest.config.codeowner.js logs progress on stdout alongside the test paths, so
// keep only the lines that look like absolute test file paths.
const files = jest.stdout
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => path.isAbsolute(s) && TEST_FILE_PATTERN.test(s));

if (files.length === 0) {
  process.stderr.write(jest.stdout);
  process.stderr.write(`No test files found for ${codeownerName}\n`);
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const file of files) {
  let root: ParsedNode;
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- untyped return from parse()
    ({ root } = parse(file) as { root: ParsedNode });
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
    process.stderr.write(`parse-fail\t${file}\t${message}\n`);
    continue;
  }
  ok++;
  const relFile = path.relative(process.cwd(), file);
  const walk = (node: ParsedNode | undefined, trail: string[]) => {
    if (!node) {
      return;
    }
    const next = node.name !== undefined ? [...trail, node.name] : trail;
    if (node.type === 'it') {
      const startLine = node.start ? node.start.line : null;
      const endLine = node.end ? node.end.line : startLine;
      process.stdout.write(JSON.stringify({ file: relFile, startLine, endLine, name: next.join(' > ') }) + '\n');
    }
    (node.children || []).forEach((c) => walk(c, next));
  };
  walk(root, []);
}

process.stderr.write(`\nparsed ${ok} files, ${failed} failed\n`);
