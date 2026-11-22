#!/usr/bin/env node

/**
 * Fails when a newly added or renamed staged file is not covered by .github/CODEOWNERS.
 *
 * Mirrors the "notowned" check that CI runs through mszostok/codeowners-validator
 * (.github/workflows/codeowners-validator.yml). CI appends every CODEOWNERS pattern to .gitignore and
 * reports the tracked files git still does not ignore. So a file counts as owned when a CODEOWNERS
 * pattern matches it, or when .gitignore already ignores it. The same git matching is used here,
 * offline, against the staged CODEOWNERS and the index.
 *
 * When the staged CODEOWNERS changes, every tracked file is checked so lost ownership is caught too.
 *
 * Usage:
 *   node scripts/codeowners-manifest/check-staged.js          # staged files (pre-commit)
 *   node scripts/codeowners-manifest/check-staged.js --all    # every tracked file in the index (pnpm codeowners:check)
 */

const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const { CODEOWNERS_FILE_PATH } = require('./constants.js');

const CI_WORKFLOW_PATH = '.github/workflows/codeowners-validator.yml';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function gitPaths(args) {
  return git([args[0], '-z', ...args.slice(1)])
    .split('\0')
    .filter(Boolean);
}

/**
 * Returns the pattern (first token) of every CODEOWNERS entry
 * @param {string} content - CODEOWNERS file contents
 * @returns {string[]} Patterns in file order
 */
function parseCodeownersPatterns(content) {
  const patterns = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    // The pattern is the first whitespace-separated token; "\ " escapes a space inside it.
    const match = line.match(/^((?:\\.|\S)+)/);
    if (match) {
      patterns.push(match[1]);
    }
  }
  return patterns;
}

/**
 * Reads not_owned_checker_skip_patterns from the CI workflow so the hook and CI share one config
 * @returns {Set<string>} Patterns CI does not count as ownership
 */
function readCiSkipPatterns() {
  let workflow;
  try {
    workflow = readFileSync(CI_WORKFLOW_PATH, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      return new Set();
    }
    throw e;
  }
  const match = workflow.match(/^\s*not_owned_checker_skip_patterns:\s*"([^"]*)"/m);
  return new Set(
    match
      ? match[1]
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : []
  );
}

/**
 * Lists tracked files (in the index) that count as owned
 * @param {string[]} patterns - CODEOWNERS patterns
 * @returns {Set<string>} Covered file paths
 */
function findCoveredFiles(patterns) {
  const dir = mkdtempSync(path.join(tmpdir(), 'codeowners-check-'));
  const patternsFile = path.join(dir, 'patterns');
  try {
    writeFileSync(patternsFile, patterns.join('\n') + '\n');
    // Matched by a CODEOWNERS pattern. --exclude-standard is left out on purpose: .gitignore rules
    // would otherwise take precedence over the patterns and hide matches.
    const owned = gitPaths(['ls-files', '--cached', '--ignored', `--exclude-from=${patternsFile}`]);
    // CI also drops tracked files that .gitignore ignores, so they are exempt from ownership.
    const ignored = gitPaths(['ls-files', '--cached', '--ignored', '--exclude-standard']);
    return new Set([...owned, ...ignored]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const checkAll = process.argv.includes('--all');

  const codeownersContent = git(['show', `:${CODEOWNERS_FILE_PATH}`]);
  const skip = readCiSkipPatterns();
  const patterns = parseCodeownersPatterns(codeownersContent).filter((p) => !skip.has(p));

  const codeownersChanged = gitPaths(['diff', '--cached', '--name-only']).includes(CODEOWNERS_FILE_PATH);
  const checkEverything = checkAll || codeownersChanged;
  const candidates = checkEverything
    ? gitPaths(['ls-files'])
    : gitPaths(['diff', '--cached', '--name-only', '-M', '--diff-filter=AR']);

  if (candidates.length === 0) {
    return 0;
  }

  const covered = findCoveredFiles(patterns);
  const unowned = candidates.filter((file) => !covered.has(file));

  if (unowned.length === 0) {
    if (checkAll) {
      console.log(`OK: all ${candidates.length} tracked files have an owner in ${CODEOWNERS_FILE_PATH}`);
    }
    return 0;
  }

  const scope = checkEverything ? 'tracked files' : 'new or renamed files';
  console.error(
    `\nCODEOWNERS check failed: no owner in ${CODEOWNERS_FILE_PATH} for ${unowned.length} of the ${scope}:\n`
  );
  for (const file of unowned) {
    console.error(`  - ${file}`);
  }
  console.error(
    `\nAdd an entry (a path pattern followed by the responsible @grafana/team) to ${CODEOWNERS_FILE_PATH}` +
      ' and stage it together with your change.' +
      `\nCI runs the same check (${CI_WORKFLOW_PATH}), so this would fail there too.` +
      '\nTo re-run it yourself: pnpm codeowners:check\n'
  );
  return 1;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    console.error('CODEOWNERS check could not run:', e.message);
    process.exit(2);
  }
}

module.exports = { parseCodeownersPatterns, readCiSkipPatterns, findCoveredFiles };
