#!/usr/bin/env node
/**
 * Reports which CODEOWNERS have the most suppressions in eslint-suppressions.json.
 * Run from repo root.
 *
 * Usage:
 *   node scripts/eslint-suppressions-by-codeowner.js
 *     → list all codeowners by total suppression count
 *   node scripts/eslint-suppressions-by-codeowner.js [--csv]
 *     → same, or CSV output with --csv (columns: codeowner,count)
 *   node scripts/eslint-suppressions-by-codeowner.js @grafana/dashboards-squad
 *     → list suppressions by file for that codeowner (with per-rule breakdown)
 *   node scripts/eslint-suppressions-by-codeowner.js @grafana/dashboards-squad [--csv]
 *     → same, or CSV with --csv (columns: file_path,total,rule,count)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CODEOWNERS_PATH = path.join(ROOT, '.github/CODEOWNERS');
const SUPPRESSIONS_PATH = path.join(ROOT, 'eslint-suppressions.json');

function escapeCsv(value) {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCodeowners(content) {
  const lines = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) {
      continue;
    }
    const pattern = trimmed.slice(0, firstSpace).trim();
    const owners = trimmed
      .slice(firstSpace)
      .trim()
      .split(/\s+/)
      .filter((t) => t.startsWith('@'));
    if (owners.length) {
      lines.push({ pattern, owners });
    }
  }
  return lines;
}

function patternToMatcher(pattern) {
  const normalized = pattern.replace(/^\//, '').trim();
  if (normalized.includes('*')) {
    const regexStr = '^' + normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$';
    const regex = new RegExp(regexStr);
    return (filePath) => regex.test(filePath) || filePath.startsWith(normalized.replace(/\*.*$/, '') + '/');
  }
  if (normalized.endsWith('/')) {
    const prefix = normalized.slice(0, -1);
    return (filePath) => filePath === prefix || filePath.startsWith(prefix + '/');
  }
  return (filePath) => filePath === normalized || filePath.startsWith(normalized + '/');
}

function buildFileToOwners(codeownersLines) {
  const matchers = codeownersLines.map(({ pattern, owners }) => ({
    match: patternToMatcher(pattern),
    owners,
  }));

  return (filePath) => {
    const normalizedPath = filePath.replace(/^\/+/, '');
    for (let i = matchers.length - 1; i >= 0; i--) {
      if (matchers[i].match(normalizedPath)) {
        return matchers[i].owners;
      }
    }
    return [];
  };
}

function sumSuppressionsByOwner(suppressions, getOwners) {
  const byOwner = new Map();

  for (const [filePath, rules] of Object.entries(suppressions)) {
    if (typeof rules !== 'object' || rules === null) {
      continue;
    }
    let fileTotal = 0;
    for (const ruleConfig of Object.values(rules)) {
      if (ruleConfig && typeof ruleConfig.count === 'number') {
        fileTotal += ruleConfig.count;
      }
    }
    if (fileTotal === 0) {
      continue;
    }

    const owners = getOwners(filePath);
    if (owners.length === 0) {
      byOwner.set('(no matching CODEOWNER)', (byOwner.get('(no matching CODEOWNER)') || 0) + fileTotal);
    } else {
      for (const owner of owners) {
        byOwner.set(owner, (byOwner.get(owner) || 0) + fileTotal);
      }
    }
  }

  return byOwner;
}

function getFileSuppressions(suppressions, getOwners) {
  const files = [];
  for (const [filePath, rules] of Object.entries(suppressions)) {
    if (typeof rules !== 'object' || rules === null) {
      continue;
    }
    const ruleCounts = {};
    let total = 0;
    for (const [ruleName, ruleConfig] of Object.entries(rules)) {
      if (ruleConfig && typeof ruleConfig.count === 'number') {
        ruleCounts[ruleName] = ruleConfig.count;
        total += ruleConfig.count;
      }
    }
    if (total === 0) {
      continue;
    }
    const owners = getOwners(filePath);
    files.push({ filePath, owners, total, ruleCounts });
  }
  return files;
}

function listSuppressionsForOwner(suppressions, getOwners, codeowner, csv) {
  const files = getFileSuppressions(suppressions, getOwners).filter((f) => f.owners.includes(codeowner));
  files.sort((a, b) => b.total - a.total);

  let grandTotal = 0;

  if (csv) {
    console.log('file_path,total,rule,count');
    for (const { filePath, total, ruleCounts } of files) {
      grandTotal += total;
      const ruleEntries = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
      for (const [rule, count] of ruleEntries) {
        console.log([escapeCsv(filePath), total, escapeCsv(rule), count].join(','));
      }
    }
    return;
  }

  console.log(`ESLint suppressions for ${codeowner} (eslint-suppressions.json):\n`);
  for (const { filePath, total, ruleCounts } of files) {
    grandTotal += total;
    console.log(`${filePath}  (${total} total)`);
    const ruleEntries = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of ruleEntries) {
      console.log(`  ${rule}  ${count}`);
    }
    console.log('');
  }
  console.log('---');
  console.log(`Total: ${grandTotal} suppressions across ${files.length} files`);
}

function main() {
  const args = process.argv.slice(2);
  const csv = args.includes('--csv');
  const codeownerArg = args.find((a) => a !== '--csv');

  const codeownersContent = fs.readFileSync(CODEOWNERS_PATH, 'utf8');
  const codeownersLines = parseCodeowners(codeownersContent);
  const getOwners = buildFileToOwners(codeownersLines);

  const suppressions = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, 'utf8'));

  if (codeownerArg) {
    listSuppressionsForOwner(suppressions, getOwners, codeownerArg, csv);
    return;
  }

  const byOwner = sumSuppressionsByOwner(suppressions, getOwners);

  const sorted = [...byOwner.entries()].sort((a, b) => b[1] - a[1]);

  if (csv) {
    console.log('codeowner,count');
    for (const [owner, count] of sorted) {
      console.log([escapeCsv(owner), count].join(','));
    }
    return;
  }

  console.log('CODEOWNERS by total ESLint suppression count (eslint-suppressions.json):\n');
  const maxName = Math.max(...sorted.map(([o]) => o.length), 20);
  for (const [owner, count] of sorted) {
    console.log(`${owner.padEnd(maxName)}  ${count}`);
  }
  console.log('\n(Suppressions are attributed to every owner listed for each file.)');
  console.log('\nUsage: node scripts/eslint-suppressions-by-codeowner.js [@codeowner/name] [--csv]');
}

main();
