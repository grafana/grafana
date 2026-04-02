#!/usr/bin/env node
/**
 * Reports which CODEOWNERS have the most suppressions in eslint-suppressions.json.
 * Run from repo root. Requires the codeowners manifest (run: yarn codeowners-manifest).
 *
 * Usage:
 *   node scripts/eslint-suppressions-by-codeowner.js
 *     → list all codeowners by total suppression count
 *   node scripts/eslint-suppressions-by-codeowner.js [--json <output-file>]
 *     → same, or JSON output with --json (format: { "summary": [{ "codeowner", "suppressions" }] })
 *   node scripts/eslint-suppressions-by-codeowner.js @grafana/dashboards-squad
 *     → list suppressions by file for that codeowner (with per-rule breakdown)
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SUPPRESSIONS_PATH = path.join(ROOT, 'eslint-suppressions.json');

const { CODEOWNERS_BY_FILENAME_JSON_PATH } = require('./codeowners-manifest/constants.js');

function loadTeamsByFilename() {
  const manifestPath = path.join(ROOT, CODEOWNERS_BY_FILENAME_JSON_PATH);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('Codeowners manifest not found.');
      console.error('Run: yarn codeowners-manifest');
      process.exit(1);
    }
    throw e;
  }
}

function buildGetOwners(teamsByFilename) {
  return (filePath) => {
    const normalized = filePath.replace(/^\/+/, '');
    return teamsByFilename[normalized] || teamsByFilename['/' + normalized] || [];
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

function listSuppressionsForOwner(suppressions, getOwners, codeowner) {
  const files = getFileSuppressions(suppressions, getOwners).filter((f) => f.owners.includes(codeowner));
  files.sort((a, b) => b.total - a.total);

  let grandTotal = 0;

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

  const jsonFlagIndex = args.indexOf('--json');
  const jsonOutput = jsonFlagIndex !== -1 ? args[jsonFlagIndex + 1] : null;
  if (jsonFlagIndex !== -1 && (!jsonOutput || jsonOutput.startsWith('--'))) {
    console.error('--json requires a file path argument');
    process.exit(1);
  }

  const remainingArgs = args.filter((a, i) => a !== '--json' && i !== jsonFlagIndex + 1);
  const codeownerArg = remainingArgs.find((a) => !a.startsWith('--'));

  const teamsByFilename = loadTeamsByFilename();
  const getOwners = buildGetOwners(teamsByFilename);

  const suppressions = JSON.parse(fs.readFileSync(SUPPRESSIONS_PATH, 'utf8'));

  if (codeownerArg) {
    listSuppressionsForOwner(suppressions, getOwners, codeownerArg);
    return;
  }

  const byOwner = sumSuppressionsByOwner(suppressions, getOwners);

  const sorted = [...byOwner.entries()].sort((a, b) => b[1] - a[1]);

  if (jsonOutput) {
    const report = {
      summary: sorted.map(([codeowner, suppressions]) => ({ codeowner, suppressions })),
    };
    fs.writeFileSync(jsonOutput, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Wrote JSON report to ${jsonOutput}`);
    return;
  }

  console.log('CODEOWNERS by total ESLint suppression count (eslint-suppressions.json):\n');
  const maxName = Math.max(...sorted.map(([o]) => o.length), 20);
  for (const [owner, count] of sorted) {
    console.log(`${owner.padEnd(maxName)}  ${count}`);
  }
  console.log('\n(Suppressions are attributed to every owner listed for each file.)');
  console.log('\nUsage: node scripts/eslint-suppressions-by-codeowner.js [@codeowner/name] [--json <output-file>]');
}

main();
