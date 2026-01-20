#!/usr/bin/env node

const fs = require('fs');

const COVERAGE_MAIN_PATH = './coverage-main/coverage-summary.json';
const COVERAGE_PR_PATH = './coverage-pr/coverage-summary.json';
const COMPARISON_OUTPUT_PATH = './coverage-comparison.md';

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
  // Round to 2 decimal places for comparison to match display precision
  const prPct = Math.round(prValue * 100) / 100;
  const mainPct = Math.round(mainValue * 100) / 100;

  if (prPct >= mainPct) {
    return '✅ Pass';
  }
  return '❌ Fail';
}

/**
 * Determines overall pass/fail status for all coverage metrics
 * @param {Object} mainSummary - Main branch coverage summary
 * @param {Object} prSummary - PR branch coverage summary
 * @returns {boolean} True if all metrics maintained or improved
 */
function getOverallStatus(mainSummary, prSummary) {
  const metrics = ['lines', 'statements', 'functions', 'branches'];
  const allPass = metrics.every((metric) => {
    // Round to 2 decimal places for comparison to match display precision
    const prPct = Math.round(prSummary[metric].pct * 100) / 100;
    const mainPct = Math.round(mainSummary[metric].pct * 100) / 100;
    return prPct >= mainPct;
  });
  return allPass;
}

/**
 * Calculates the difference between PR and main coverage
 * @param {number} prValue - PR coverage percentage
 * @param {number} mainValue - Main coverage percentage
 * @returns {string} Formatted delta (e.g., "+1.2%" or "-0.5%")
 */
function formatDelta(prValue, mainValue) {
  const delta = prValue - mainValue;
  if (delta > 0) {
    return `+${delta.toFixed(2)}%`;
  } else if (delta < 0) {
    return `${delta.toFixed(2)}%`;
  }
  return '—';
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

  const overallStatus = overallPass ? '✅ Pass' : '❌ Fail';

  return `## Test Coverage Checks ${overallStatus} for ${teamName}

| Metric | Main | PR | Change | Status |
|--------|------|----|----|--------|
${tableRows}

**Run locally:** 💻 \`yarn test:coverage:by-codeowner ${teamName}\`

**Break glass:** 🚨 In case of emergency, adding the \`no-check-frontend-test-coverage\` label to this PR will skip checks.

**Compared:**

- PR: \`${prCoverage.commit.substring(0, 7)}\` (${prCoverage.timestamp})
- Main: \`${mainCoverage.commit.substring(0, 7)}\` (${mainCoverage.timestamp})

`;
}

/**
 * Compares coverage between main and PR branches and generates a markdown report
 * @param {string} mainPath - Path to main branch coverage summary JSON
 * @param {string} prPath - Path to PR branch coverage summary JSON
 * @param {string} outputPath - Path to write comparison markdown
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

  try {
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`✅ Coverage comparison written to ${outputPath}`);
  } catch (err) {
    console.error(`Error writing output file: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  compareCoverageByCodeowner();
}

module.exports = { compareCoverageByCodeowner, generateMarkdown, getOverallStatus };
