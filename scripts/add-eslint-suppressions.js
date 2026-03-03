#!/usr/bin/env node
/**
 * Parses ESLint stdout (stylish format) and adds matching issues to eslint-suppressions.json.
 *
 * Usage:
 *   yarn lint 2>&1 | node scripts/add-eslint-suppressions.js
 *   node scripts/add-eslint-suppressions.js < eslint-output.txt
 *   node scripts/add-eslint-suppressions.js eslint-output.txt
 *
 * Run from repo root. Only adds suppressions; does not remove existing ones.
 * Use `yarn lint:suppressions:prune` to prune suppressions for fixed issues.
 *
 * Options:
 *   --dry-run  Print what would be added and exit without writing.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SUPPRESSIONS_PATH = path.join(ROOT, 'eslint-suppressions.json');

// ESLint stylish: "  1:15  error  message here  rule-name"
const ERROR_LINE_RE = /^\s{2}\d+:\d+\s+(?:error|warn(?:ing)?)\s+.+\s+(\S+)$/;

function normalizePath(filePath) {
  const trimmed = filePath.trim();
  const normalized = path.normalize(trimmed);
  if (path.isAbsolute(normalized)) {
    const relative = path.relative(ROOT, normalized);
    return relative.startsWith('..') ? trimmed : relative.replace(/\\/g, '/');
  }
  return normalized.replace(/\\/g, '/');
}

function parseEslintOutput(text) {
  const lines = text.split('\n');
  const byFileAndRule = new Map(); // key: "${file}\n${rule}" -> count
  let currentFile = null;

  for (const line of lines) {
    const errorMatch = line.match(ERROR_LINE_RE);
    if (errorMatch) {
      const rule = errorMatch[1];
      if (currentFile) {
        const key = `${currentFile}\n${rule}`;
        byFileAndRule.set(key, (byFileAndRule.get(key) || 0) + 1);
      }
      continue;
    }

    // Treat as file path if line is not only whitespace and doesn't look like an error line
    if (line.trim() && !ERROR_LINE_RE.test(line)) {
      // Skip summary lines like "✖ 14 problems"
      if (!/^[\s✔✖⚠]*\d+\s+problem/.test(line.trim())) {
        currentFile = normalizePath(line);
      }
    }
  }

  return byFileAndRule;
}

function applySuppressions(suppressions, byFileAndRule) {
  let added = 0;
  for (const [key, count] of byFileAndRule) {
    const [file, rule] = key.split('\n');
    if (!file || !rule) {
      continue;
    }

    if (!suppressions[file]) {
      suppressions[file] = {};
    }
    if (!suppressions[file][rule]) {
      suppressions[file][rule] = { count: 0 };
    }
    suppressions[file][rule].count += count;
    added += count;
  }
  return added;
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');
  const input =
    args[0] !== undefined ? fs.readFileSync(path.resolve(process.cwd(), args[0]), 'utf8') : fs.readFileSync(0, 'utf8');
  const byFileAndRule = parseEslintOutput(input);
  if (byFileAndRule.size === 0) {
    console.error('add-eslint-suppressions: no ESLint errors found in input');
    process.exit(1);
  }

  const suppressions = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, 'utf8'));
  const added = applySuppressions(suppressions, byFileAndRule);

  if (dryRun) {
    console.log('Would add', added, 'suppression(s). Affected file+rule:');
    for (const [key, count] of byFileAndRule) {
      const [file, rule] = key.split('\n');
      console.log(`  ${file}  ${rule}  +${count}`);
    }
    return;
  }

  // Sort top-level keys for stable diffs
  const sorted = Object.keys(suppressions)
    .sort()
    .reduce((acc, file) => {
      const rules = suppressions[file];
      acc[file] = Object.keys(rules)
        .sort()
        .reduce((r, rule) => {
          r[rule] = rules[rule];
          return r;
        }, {});
      return acc;
    }, {});

  fs.writeFileSync(SUPPRESSIONS_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.error(`add-eslint-suppressions: added ${added} suppression(s) to ${SUPPRESSIONS_PATH}`);
}

main();
