#!/usr/bin/env node

const fs = require('fs');

const COVERAGE_MAIN_PATH = './coverage-main/coverage-summary.json';
const COVERAGE_PR_PATH = './coverage-pr/coverage-summary.json';
const COMPARISON_OUTPUT_PATH = './coverage-comparison.md';

// Drops of this many percentage points or less do not fail the check. A single
// added branch or line in a large codebase can move the percentage by 0.01-0.02
// without meaningfully reducing test coverage.
const DROP_TOLERANCE_PCT = 0.02;

// Guards against binary floating point error when comparing a rounded delta
// against the tolerance (e.g. 79.96 - 79.94 === 0.020000000000010232).
const EPSILON = 1e-9;

const METRICS = ['lines', 'statements', 'functions', 'branches'];

/**
 * Rounds a percentage to 2 decimal places to match display precision
 * @param {number} value - Percentage value
 * @returns {number} Rounded percentage
 */
function roundPct(value) {
  return Number(value.toFixed(2));
}

/**
 * Classifies a coverage change as improved/unchanged, a tolerated drop, or a regression
 * @param {number} mainValue - Main branch coverage percentage
 * @param {number} prValue - PR branch coverage percentage
 * @returns {'pass'|'tolerated'|'fail'}
 */
function classifyChange(mainValue, prValue) {
  const drop = roundPct(mainValue) - roundPct(prValue);

  if (drop <= 0) {
    return 'pass';
  }
  if (drop <= DROP_TOLERANCE_PCT + EPSILON) {
    return 'tolerated';
  }
  return 'fail';
}

/**
 * Reads and parses a coverage summary JSON file
 * @param {string} filePath - Path to coverage summary file
 * @returns {Object} Parsed coverage data
 */
function readCoverageFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading coverage file ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Formats a number as a percentage string
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage (e.g., "85.34%")
 */
function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

/**
 * Returns status icon based on coverage comparison
 * @param {number} mainValue - Main branch coverage percentage
 * @param {number} prValue - PR branch coverage percentage
 * @returns {string} Status icon and text
 */
function getStatusIcon(mainValue, prValue) {
  switch (classifyChange(mainValue, prValue)) {
    case 'pass':
      return '✅ Pass';
    case 'tolerated':
      return '🟡 Within tolerance';
    default:
      return '❌ Fail';
  }
}

/**
 * Determines overall pass/fail status for all coverage metrics
 * @param {Object} mainSummary - Main branch coverage summary
 * @param {Object} prSummary - PR branch coverage summary
 * @returns {boolean} True if no metric dropped by more than the tolerance
 */
function getOverallStatus(mainSummary, prSummary) {
  return METRICS.every((metric) => classifyChange(mainSummary[metric].pct, prSummary[metric].pct) !== 'fail');
}

/**
 * Reports whether any metric dropped within the tolerated range
 * @param {Object} mainSummary - Main branch coverage summary
 * @param {Object} prSummary - PR branch coverage summary
 * @returns {boolean} True if at least one metric had a tolerated drop
 */
function hasToleratedDrop(mainSummary, prSummary) {
  return METRICS.some((metric) => classifyChange(mainSummary[metric].pct, prSummary[metric].pct) === 'tolerated');
}

/**
 * Calculates the difference between PR and main coverage
 * @param {number} prValue - PR coverage percentage
 * @param {number} mainValue - Main coverage percentage
 * @returns {string} Formatted delta (e.g., "+1.2%" or "-0.5%")
 */
function formatDelta(prValue, mainValue) {
  // Round each side first, same as classifyChange, so the displayed delta never
  // disagrees with the status/tolerance columns near the rounding boundary.
  const delta = roundPct(prValue) - roundPct(mainValue);
  if (delta > 0) {
    return `+${delta.toFixed(2)}%`;
  } else if (delta < 0) {
    return `${delta.toFixed(2)}%`;
  }
  return '—';
}

/**
 * Identifies files where coverage decreased between main and PR branches
 * @param {Object} mainCoverage - Main branch coverage data (with optional .files map)
 * @param {Object} prCoverage - PR branch coverage data (with optional .files map)
 * @returns {Array<{path: string, main: Object, pr: Object}>}
 */
function getFilesWithDecreasedCoverage(mainCoverage, prCoverage) {
  const mainFiles = mainCoverage.files || {};
  const prFiles = prCoverage.files || {};
  const decreased = [];

  for (const [filePath, prFile] of Object.entries(prFiles)) {
    const mainFile = mainFiles[filePath];
    if (!mainFile) {
      continue; // new file — not a regression
    }

    const anyDecreased = METRICS.some((metric) => roundPct(prFile[metric].pct) < roundPct(mainFile[metric].pct));

    if (anyDecreased) {
      decreased.push({ path: filePath, main: mainFile, pr: prFile });
    }
  }

  // eslint-disable-next-line @grafana/no-locale-compare
  return decreased.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Generates the "files with decreased coverage" markdown section
 * @param {Array} decreasedFiles - Output of getFilesWithDecreasedCoverage
 * @param {string} artifactUrl - URL to the uploaded HTML coverage artifact
 * @param {string} prSha - PR head commit SHA for GitHub file links
 * @param {string} repo - GitHub repository in "owner/repo" format
 * @returns {string} Markdown section
 */
function generateFailureDetailsSection(decreasedFiles, artifactUrl, prSha, repo) {
  const lines = [];
  if (decreasedFiles.length === 0) {
    return lines.join('\n');
  }

  lines.push(`### Files with Decreased Coverage\n`);

  if (artifactUrl) {
    lines.push(`📊 [View full HTML coverage report](${artifactUrl})\n`);
  }

  const MAX_FILES = 20;
  const headers = ['File', 'Lines', 'Statements', 'Functions', 'Branches'];

  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`|------|-------|------------|-----------|----------|`);

  const shown = decreasedFiles.slice(0, MAX_FILES);
  for (const { path, main, pr } of shown) {
    const metricCells = METRICS.map((metric) => {
      const prPct = roundPct(pr[metric].pct);
      const mainPct = roundPct(main[metric].pct);
      return prPct < mainPct ? `${formatPercentage(mainPct)} → ${formatPercentage(prPct)}` : '—';
    });

    lines.push(`| ${path} | ${metricCells.join(' | ')} |`);
  }

  if (decreasedFiles.length > MAX_FILES) {
    lines.push(`\n_...and ${decreasedFiles.length - MAX_FILES} more files. See the full report for details._`);
  }

  return lines.join('\n');
}

/**
 * Generates markdown report comparing main and PR coverage
 * @param {Object} mainCoverage - Main branch coverage data
 * @param {Object} prCoverage - PR branch coverage data
 * @returns {string} Markdown formatted report
 */
function generateMarkdown(mainCoverage, prCoverage) {
  const teamName = prCoverage.team;
  const mainSummary = mainCoverage.summary;
  const prSummary = prCoverage.summary;

  const overallPass = getOverallStatus(mainSummary, prSummary);

  const rows = [
    {
      metric: 'Lines',
      main: mainSummary.lines.pct,
      pr: prSummary.lines.pct,
    },
    {
      metric: 'Statements',
      main: mainSummary.statements.pct,
      pr: prSummary.statements.pct,
    },
    {
      metric: 'Functions',
      main: mainSummary.functions.pct,
      pr: prSummary.functions.pct,
    },
    {
      metric: 'Branches',
      main: mainSummary.branches.pct,
      pr: prSummary.branches.pct,
    },
  ];

  const tableRows = rows
    .map((row) => {
      const status = getStatusIcon(row.main, row.pr);
      const delta = formatDelta(row.pr, row.main);
      return `| ${row.metric} | ${formatPercentage(row.main)} | ${formatPercentage(row.pr)} | ${delta} | ${status} |`;
    })
    .join('\n');

  const tolerated = hasToleratedDrop(mainSummary, prSummary);

  let overallStatus = '✅ Passed';
  if (!overallPass) {
    overallStatus = '❌ Failed';
  } else if (tolerated) {
    overallStatus = '🟡 Passed within tolerance';
  }

  let failureDetails = '';
  if (!overallPass || tolerated) {
    const artifactUrl = process.env.COVERAGE_ARTIFACT_URL || '';
    const prSha = process.env.PR_SHA || '';
    const repo = process.env.GITHUB_REPOSITORY || '';
    const decreasedFiles = getFilesWithDecreasedCoverage(mainCoverage, prCoverage);
    failureDetails = generateFailureDetailsSection(decreasedFiles, artifactUrl, prSha, repo);
  }

  // Only explain the tolerance when it is what let the check pass. On a failure the
  // note would contradict the result and draw attention away from the real regression.
  const toleranceNote =
    overallPass && tolerated
      ? `\n_Drops of ${formatPercentage(DROP_TOLERANCE_PCT)} or less are tolerated and do not fail the check._\n`
      : '';

  return `## Test Coverage Checks ${overallStatus} for \`${teamName}\`

| Metric | Main | PR | Change | Status |
|--------|------|----|----|--------|
${tableRows}
${toleranceNote}
${failureDetails}

**Run locally:** 💻 \`yarn test:coverage:by-codeowner ${teamName}\`

**Break glass:** 🚨 In case of emergency, adding the \`no-check-frontend-test-coverage\` label to this PR will skip checks.
`;
}

/**
 * Compares coverage between main and PR branches and generates a markdown report
 * @param {string} mainPath - Path to main branch coverage summary JSON
 * @param {string} prPath - Path to PR branch coverage summary JSON
 * @param {string} outputPath - Path to write comparison markdown
 * @returns {boolean} True if coverage check passed
 */
function compareCoverageByCodeowner(
  mainPath = COVERAGE_MAIN_PATH,
  prPath = COVERAGE_PR_PATH,
  outputPath = COMPARISON_OUTPUT_PATH
) {
  const mainCoverage = readCoverageFile(mainPath);
  const prCoverage = readCoverageFile(prPath);

  if (!mainCoverage.summary || !prCoverage.summary) {
    console.error('Error: Coverage summary data is missing or invalid');
    process.exit(1);
  }

  const markdown = generateMarkdown(mainCoverage, prCoverage);
  const overallPass = getOverallStatus(mainCoverage.summary, prCoverage.summary);

  try {
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`✅ Coverage comparison written to ${outputPath}`);
  } catch (err) {
    console.error(`Error writing output file: ${err.message}`);
    process.exit(1);
  }

  return overallPass;
}

if (require.main === module) {
  const passed = compareCoverageByCodeowner();
  if (!passed) {
    console.error(
      `❌ Coverage check failed: One or more metrics dropped by more than ${formatPercentage(DROP_TOLERANCE_PCT)}`
    );
    process.exit(1);
  }
  console.log('✅ Coverage check passed: All metrics maintained, improved, or within tolerance');
}

module.exports = {
  DROP_TOLERANCE_PCT,
  compareCoverageByCodeowner,
  formatDelta,
  generateMarkdown,
  getStatusIcon,
  getOverallStatus,
  hasToleratedDrop,
  getFilesWithDecreasedCoverage,
  generateFailureDetailsSection,
};
