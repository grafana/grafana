#!/usr/bin/env node

const fs = require('fs');

const COVERAGE_PR_PATH = './coverage-pr/coverage-summary.json';
const COVERAGE_MAIN_PATH = './coverage-main/coverage-summary.json';
const COMPARISON_OUTPUT_PATH = './coverage-comparison.md';

function readCoverageFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading coverage file ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

function formatPercentage(value) {
  return `${value.toFixed(1)}%`;
}

function getStatusIcon(prValue, mainValue) {
  if (prValue >= mainValue) {
    return '✅ Pass';
  }
  return '❌ Fail';
}

function getOverallStatus(prSummary, mainSummary) {
  const metrics = ['lines', 'statements', 'functions', 'branches'];
  const allPass = metrics.every((metric) => prSummary[metric].pct >= mainSummary[metric].pct);
  return allPass;
}

function generateMarkdown(prCoverage, mainCoverage) {
  const teamName = prCoverage.team;
  const prSum = prCoverage.summary;
  const mainSum = mainCoverage.summary;

  const overallPass = getOverallStatus(prSum, mainSum);

  const rows = [
    {
      metric: 'Lines',
      main: mainSum.lines.pct,
      pr: prSum.lines.pct,
    },
    {
      metric: 'Statements',
      main: mainSum.statements.pct,
      pr: prSum.statements.pct,
    },
    {
      metric: 'Functions',
      main: mainSum.functions.pct,
      pr: prSum.functions.pct,
    },
    {
      metric: 'Branches',
      main: mainSum.branches.pct,
      pr: prSum.branches.pct,
    },
  ];

  const tableRows = rows
    .map((row) => {
      const status = getStatusIcon(row.pr, row.main);
      return `| ${row.metric} | ${formatPercentage(row.main)} | ${formatPercentage(row.pr)} | ${status} |`;
    })
    .join('\n');

  const overallStatus = overallPass ? '✅ Pass' : '❌ Fail';
  const overallMessage = overallPass ? 'Coverage maintained or improved' : 'Coverage decreased in one or more metrics';

  return `## Test Coverage Report - ${teamName}

| Metric | Main Branch | PR Branch | Status |
|--------|-------------|-----------|--------|
${tableRows}

**Overall: ${overallStatus}** - ${overallMessage}

<details>
<summary>Coverage Details</summary>

- **PR Branch**: \`${prCoverage.commit.substring(0, 7)}\` (${prCoverage.timestamp})
- **Main Branch**: \`${mainCoverage.commit.substring(0, 7)}\` (${mainCoverage.timestamp})

</details>
`;
}

function main() {
  const prCoverage = readCoverageFile(COVERAGE_PR_PATH);
  const mainCoverage = readCoverageFile(COVERAGE_MAIN_PATH);

  if (!prCoverage.summary || !mainCoverage.summary) {
    console.error('Error: Coverage summary data is missing or invalid');
    process.exit(1);
  }

  const markdown = generateMarkdown(prCoverage, mainCoverage);

  try {
    fs.writeFileSync(COMPARISON_OUTPUT_PATH, markdown, 'utf8');
    console.log(`✅ Coverage comparison written to ${COMPARISON_OUTPUT_PATH}`);
  } catch (err) {
    console.error(`Error writing output file: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateMarkdown, getOverallStatus };
