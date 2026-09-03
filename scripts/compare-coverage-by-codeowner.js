#!/usr/bin/env node

// Compares one codeowner's coverage between main and PR branches, then writes the
// result straight to this matrix leg's own $GITHUB_STEP_SUMMARY — each of the
// `coverage` job's legs in check-frontend-test-coverage.yml runs this independently,
// so every opted-in team's block lands on the run's Summary page under its own job,
// with no separate fan-in job or intermediate artifact tying them together.

const fs = require('fs');

const COVERAGE_MAIN_PATH = './coverage-main/coverage-summary.json';
const COVERAGE_PR_PATH = './coverage-pr/coverage-summary.json';

// Drops of this many percentage points or less do not fail the check. A single
// added branch or line in a large codebase can move the percentage by 0.01-0.02
// without meaningfully reducing test coverage.
const DROP_TOLERANCE_PCT = 0.02;

const METRICS = ['lines', 'statements', 'functions', 'branches'];
const METRIC_LABELS = { lines: 'Lines', statements: 'Statements', functions: 'Functions', branches: 'Branches' };

// Bounds on how many files are embedded in the job summary. There's no hard size
// pressure (this isn't a PR comment), but a pathological diff could otherwise
// generate a huge summary — the full HTML report link covers anything truncated.
const MAX_DECREASED_FILES = 200;
const MAX_INCREASED_FILES_SHOWN = 5;

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
  // Round each side first so the drop matches what's displayed (see formatDelta).
  // Subtracting two already-rounded numbers can still leave binary floating point
  // error right at the tolerance boundary (e.g. 79.96 - 79.94 === 0.020000000000010232),
  // so round the difference once more instead of comparing against it directly.
  const drop = roundPct(roundPct(mainValue) - roundPct(prValue));

  if (drop <= 0) {
    return 'pass';
  }
  if (drop <= DROP_TOLERANCE_PCT) {
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
  return '±0.00%';
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
 * Identifies files whose coverage improved between main and PR branches, with no
 * metric regressing. A file with a mix of increases and decreases is surfaced only
 * via getFilesWithDecreasedCoverage, so a single file's change is never split
 * across both the regression and improvement sections of the summary.
 * @param {Object} mainCoverage - Main branch coverage data (with optional .files map)
 * @param {Object} prCoverage - PR branch coverage data (with optional .files map)
 * @returns {Array<{path: string, main: Object, pr: Object, totalIncrease: number}>} Sorted by totalIncrease descending
 */
function getFilesWithIncreasedCoverage(mainCoverage, prCoverage) {
  const mainFiles = mainCoverage.files || {};
  const prFiles = prCoverage.files || {};
  const increased = [];

  for (const [filePath, prFile] of Object.entries(prFiles)) {
    const mainFile = mainFiles[filePath];
    if (!mainFile) {
      continue; // new file — nothing to compare against
    }

    const anyDecreased = METRICS.some((metric) => roundPct(prFile[metric].pct) < roundPct(mainFile[metric].pct));
    if (anyDecreased) {
      continue;
    }

    const anyIncreased = METRICS.some((metric) => roundPct(prFile[metric].pct) > roundPct(mainFile[metric].pct));
    if (!anyIncreased) {
      continue;
    }

    const totalIncrease = roundPct(
      METRICS.reduce((sum, metric) => sum + (roundPct(prFile[metric].pct) - roundPct(mainFile[metric].pct)), 0)
    );
    increased.push({ path: filePath, main: mainFile, pr: prFile, totalIncrease });
  }

  return increased.sort((a, b) => b.totalIncrease - a.totalIncrease);
}

/**
 * Reduces a {path, main, pr} file entry down to the rounded per-metric cells the
 * summary renderer needs, without dragging the full coverage-summary shape along.
 * @param {{path: string, main: Object, pr: Object}} entry
 * @returns {{path: string, cells: Object}} cells is keyed by metric id; a metric
 *   with no change is null so the renderer can show "—"
 */
function toFileRow(entry) {
  const cells = {};
  for (const metric of METRICS) {
    const prPct = roundPct(entry.pr[metric].pct);
    const mainPct = roundPct(entry.main[metric].pct);
    cells[metric] = prPct !== mainPct ? { main: mainPct, pr: prPct } : null;
  }
  return { path: entry.path, cells };
}

/**
 * Builds the metrics comparison rows shared by the pass/fail decision and the summary table
 * @param {Object} mainSummary - Main branch coverage summary
 * @param {Object} prSummary - PR branch coverage summary
 * @returns {Array<{metric: string, main: number, pr: number, delta: string, status: string}>}
 */
function buildMetricRows(mainSummary, prSummary) {
  return METRICS.map((metric) => ({
    metric: METRIC_LABELS[metric],
    main: roundPct(mainSummary[metric].pct),
    pr: roundPct(prSummary[metric].pct),
    delta: formatDelta(prSummary[metric].pct, mainSummary[metric].pct),
    status: getStatusIcon(mainSummary[metric].pct, prSummary[metric].pct),
  }));
}

/**
 * Builds the structured comparison result for one codeowner. This is the single
 * source of truth for both the pass/fail decision and the job-summary markdown
 * rendered by renderTeamMarkdown.
 * @param {Object} mainCoverage - Main branch coverage data
 * @param {Object} prCoverage - PR branch coverage data
 * @param {{artifactUrl?: string, prSha?: string, repo?: string}} meta
 * @returns {Object} Structured coverage comparison result
 */
function buildCoverageResult(mainCoverage, prCoverage, meta = {}) {
  const team = prCoverage.team;
  const mainSummary = mainCoverage.summary;
  const prSummary = prCoverage.summary;

  const overallPass = getOverallStatus(mainSummary, prSummary);
  const tolerated = hasToleratedDrop(mainSummary, prSummary);

  let status = 'pass';
  if (!overallPass) {
    status = 'fail';
  } else if (tolerated) {
    status = 'tolerated';
  }

  const allDecreased = getFilesWithDecreasedCoverage(mainCoverage, prCoverage);
  const allIncreased = getFilesWithIncreasedCoverage(mainCoverage, prCoverage);

  return {
    team,
    affected: true,
    status,
    metrics: buildMetricRows(mainSummary, prSummary),
    decreasedFiles: allDecreased.slice(0, MAX_DECREASED_FILES).map(toFileRow),
    decreasedFilesTotal: allDecreased.length,
    increasedFilesTop: allIncreased.slice(0, MAX_INCREASED_FILES_SHOWN).map(({ path, totalIncrease }) => ({
      path,
      totalIncrease,
    })),
    increasedFilesTotal: allIncreased.length,
    artifactUrl: meta.artifactUrl || '',
    prSha: meta.prSha || '',
    repo: meta.repo || '',
  };
}

/**
 * Renders the metrics comparison table for one codeowner
 * @param {Array} metrics - Output of buildMetricRows
 * @returns {string} Markdown table
 */
function renderMetricsTable(metrics) {
  const lines = ['| Metric | Main | PR | Change | Status |', '|--------|------|----|----|--------|'];
  for (const row of metrics) {
    lines.push(
      `| ${row.metric} | ${formatPercentage(row.main)} | ${formatPercentage(row.pr)} | ${row.delta} | ${row.status} |`
    );
  }
  return lines.join('\n');
}

/**
 * Renders the file-by-file decreased coverage table for one codeowner
 * @param {Object} result - Structured coverage result (see buildCoverageResult)
 * @returns {string} Markdown table, wrapped in a <details> block
 */
function renderDecreasedFilesDetails(result) {
  const headers = ['File', 'Lines', 'Statements', 'Functions', 'Branches'];
  const lines = [
    `<details><summary>Files with decreased coverage (${result.decreasedFilesTotal})</summary>`,
    '',
    `| ${headers.join(' | ')} |`,
    `|------|-------|------------|-----------|----------|`,
  ];

  for (const file of result.decreasedFiles) {
    const cells = METRICS.map((metric) => {
      const cell = file.cells[metric];
      return cell ? `${formatPercentage(cell.main)} → ${formatPercentage(cell.pr)}` : '—';
    });
    lines.push(`| ${file.path} | ${cells.join(' | ')} |`);
  }

  if (result.decreasedFilesTotal > result.decreasedFiles.length) {
    lines.push('');
    lines.push(`_...and ${result.decreasedFilesTotal - result.decreasedFiles.length} more files._`);
  }

  lines.push('');
  lines.push('</details>');
  return lines.join('\n');
}

/**
 * Renders one codeowner's coverage-increase note as a single compact line — increases
 * are a nice-to-have, so they don't get the same file-by-file detail as decreases.
 * @param {Object} result - Structured coverage result
 * @returns {string} Markdown line
 */
function renderIncreaseNote(result) {
  const top = result.increasedFilesTop.map((file) => `\`${file.path}\` (+${file.totalIncrease.toFixed(2)}pp)`);
  const remaining = result.increasedFilesTotal - result.increasedFilesTop.length;
  const more = remaining > 0 ? `, and ${remaining} more` : '';
  return `📈 ${result.increasedFilesTotal} file(s) improved: ${top.join(', ')}${more}`;
}

/**
 * Renders one codeowner's job-summary block: status heading, metrics, the HTML
 * report link, and the file-by-file breakdown. Each `coverage` matrix leg writes
 * its own block via this function — there's no separate fan-in step, so every
 * status (pass, tolerated, fail) needs to be fully self-contained here.
 *
 * The skip-label reminder and the run-locally command are the same for every team,
 * so they're written once by the coverage-summary job instead of repeated here —
 * this block sticks to what's actually specific to this codeowner.
 * @param {Object} result - Structured coverage result
 * @returns {string} Markdown for this leg's $GITHUB_STEP_SUMMARY
 */
function renderTeamMarkdown(result) {
  const icon = { fail: '❌', tolerated: '🟡', pass: '✅' }[result.status];
  const lines = [`### ${icon} ${result.team}`, '', renderMetricsTable(result.metrics), ''];

  if (result.status === 'tolerated') {
    lines.push(
      `_Drops of ${formatPercentage(DROP_TOLERANCE_PCT)} or less are tolerated and do not fail the check._`,
      ''
    );
  }

  if (result.artifactUrl) {
    lines.push(`📊 [Full HTML coverage report](${result.artifactUrl})`, '');
  }

  if (result.decreasedFiles.length > 0) {
    lines.push(renderDecreasedFilesDetails(result), '');
  }

  if (result.increasedFilesTotal > 0) {
    lines.push(renderIncreaseNote(result));
  }

  return lines.join('\n').trimEnd();
}

/**
 * Compares coverage between main and PR branches for one codeowner
 * @param {string} mainPath - Path to main branch coverage summary JSON
 * @param {string} prPath - Path to PR branch coverage summary JSON
 * @returns {Object} Structured coverage comparison result
 */
function compareCoverageByCodeowner(mainPath = COVERAGE_MAIN_PATH, prPath = COVERAGE_PR_PATH) {
  const mainCoverage = readCoverageFile(mainPath);
  const prCoverage = readCoverageFile(prPath);

  if (!mainCoverage.summary || !prCoverage.summary) {
    console.error('Error: Coverage summary data is missing or invalid');
    process.exit(1);
  }

  return buildCoverageResult(mainCoverage, prCoverage, {
    artifactUrl: process.env.COVERAGE_ARTIFACT_URL || '',
    prSha: process.env.PR_SHA || '',
    repo: process.env.GITHUB_REPOSITORY || '',
  });
}

if (require.main === module) {
  const result = compareCoverageByCodeowner();
  console.log(renderTeamMarkdown(result));
  if (result.status === 'fail') {
    console.error(
      `❌ Coverage check failed: One or more metrics dropped by more than ${formatPercentage(DROP_TOLERANCE_PCT)}`
    );
    process.exit(1);
  }
}

module.exports = {
  DROP_TOLERANCE_PCT,
  METRICS,
  METRIC_LABELS,
  compareCoverageByCodeowner,
  buildCoverageResult,
  buildMetricRows,
  formatDelta,
  formatPercentage,
  getStatusIcon,
  getOverallStatus,
  hasToleratedDrop,
  getFilesWithDecreasedCoverage,
  getFilesWithIncreasedCoverage,
  renderMetricsTable,
  renderDecreasedFilesDetails,
  renderIncreaseNote,
  renderTeamMarkdown,
};
