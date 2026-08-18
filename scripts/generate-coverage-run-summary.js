#!/usr/bin/env node

// Fans in the per-codeowner coverage-comparison.json artifacts produced by
// compare-coverage-by-codeowner.js (one per matrix leg of the `coverage` job in
// check-frontend-test-coverage.yml) into a single markdown summary. The workflow
// writes this to the job's $GITHUB_STEP_SUMMARY so a user landing on the failed
// check gets one detailed report instead of having to open each team's job.

const fs = require('fs');
const path = require('path');

const { METRICS, DROP_TOLERANCE_PCT, formatPercentage } = require('./compare-coverage-by-codeowner.js');

const DEFAULT_RESULTS_DIR = './coverage-results';

/**
 * Reads every coverage-comparison result JSON file from a directory
 * @param {string} dir - Directory containing one JSON file per codeowner (as produced by
 *   `actions/download-artifact` with `merge-multiple: true`)
 * @returns {Array<Object>} Parsed result objects
 */
function readResults(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
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
 * Renders one codeowner's regression detail section: metrics, the skip-label
 * reminder (placed right under the status so it's never far from a failure), the
 * HTML report link, and the file-by-file breakdown.
 * @param {Object} result - Structured coverage result
 * @returns {string} Markdown section
 */
function renderTeamDetail(result) {
  const icon = result.status === 'fail' ? '❌' : '🟡';
  const lines = [`### ${icon} ${result.team}`, '', renderMetricsTable(result.metrics), ''];

  if (result.status === 'fail') {
    lines.push(
      '🚨 **Skip label:** in an emergency, add the `no-check-frontend-test-coverage` label to this PR to bypass this check.'
    );
  } else {
    lines.push(`_Drops of ${formatPercentage(DROP_TOLERANCE_PCT)} or less are tolerated and do not fail the check._`);
  }
  lines.push('');

  if (result.artifactUrl) {
    lines.push(`📊 [Full HTML coverage report](${result.artifactUrl})`);
    lines.push('');
  }

  if (result.decreasedFiles.length > 0) {
    lines.push(renderDecreasedFilesDetails(result));
    lines.push('');
  }

  lines.push(`💻 Run locally: \`${result.runLocallyCommand}\``);
  return lines.join('\n');
}

/**
 * Renders one row of the compact "passing teams" table
 * @param {Object} result - Structured coverage result
 * @returns {string} Markdown table row
 */
function renderPassingRow(result) {
  const cell = (label) => result.metrics.find((metric) => metric.metric === label).delta;
  return `| ${result.team} | ${cell('Lines')} | ${cell('Statements')} | ${cell('Functions')} | ${cell('Branches')} |`;
}

/**
 * Renders one codeowner's coverage-increase summary as a single compact line —
 * increases are a nice-to-have, so they're intentionally not given the same
 * file-by-file detail as regressions, which stay grouped together above for debugging.
 * @param {Object} result - Structured coverage result
 * @returns {string} Markdown list item
 */
function renderIncreaseSummaryLine(result) {
  const top = result.increasedFilesTop.map((file) => `\`${file.path}\` (+${file.totalIncrease.toFixed(2)}pp)`);
  const remaining = result.increasedFilesTotal - result.increasedFilesTop.length;
  const more = remaining > 0 ? `, and ${remaining} more` : '';
  return `- **${result.team}** — ${result.increasedFilesTotal} file(s) improved: ${top.join(', ')}${more}`;
}

/**
 * Builds the full fan-in markdown summary from every codeowner's result
 * @param {Array<Object>} results - Parsed coverage-comparison.json contents, one per codeowner
 * @returns {string} Markdown for $GITHUB_STEP_SUMMARY
 */
function generateRunSummary(results) {
  const affected = results.filter((result) => result.affected !== false);
  const notAffected = results.filter((result) => result.affected === false);

  const sortByTeam = (a, b) =>
    // eslint-disable-next-line @grafana/no-locale-compare
    a.team.localeCompare(b.team);

  const failed = affected.filter((result) => result.status === 'fail').sort(sortByTeam);
  const tolerated = affected.filter((result) => result.status === 'tolerated').sort(sortByTeam);
  const passed = affected.filter((result) => result.status === 'pass').sort(sortByTeam);

  const lines = ['# Frontend Test Coverage Summary', ''];

  if (affected.length === 0) {
    lines.push('_No opted-in codeowners were affected by this PR._');
    if (notAffected.length > 0) {
      lines.push(
        '',
        `<sub>⏭️ Checked but not affected: ${notAffected
          .map((result) => result.team)
          .sort(sortByTeam)
          .join(', ')}</sub>`
      );
    }
    return lines.join('\n');
  }

  lines.push(
    `${affected.length} team(s) checked · ✅ ${passed.length} passed · 🟡 ${tolerated.length} within tolerance · ❌ ${failed.length} failed`,
    ''
  );

  const regressions = [...failed, ...tolerated];
  if (regressions.length > 0) {
    lines.push('## Coverage regressions', '');
    for (const result of regressions) {
      lines.push(renderTeamDetail(result), '');
    }
  }

  if (passed.length > 0) {
    lines.push(
      '## ✅ Passing teams',
      '',
      '| Team | Lines | Statements | Functions | Branches |',
      '|------|-------|------------|-----------|----------|',
      ...passed.map(renderPassingRow),
      ''
    );
  }

  const improved = affected.filter((result) => result.increasedFilesTotal > 0).sort(sortByTeam);
  if (improved.length > 0) {
    lines.push('## 📈 Coverage increases', '', ...improved.map(renderIncreaseSummaryLine), '');
  }

  if (notAffected.length > 0) {
    lines.push(
      `<sub>⏭️ Not affected by this PR's changes: ${notAffected
        .map((result) => result.team)
        .sort(sortByTeam)
        .join(', ')}</sub>`
    );
  }

  return lines.join('\n');
}

if (require.main === module) {
  const dir = process.argv[2] || DEFAULT_RESULTS_DIR;
  console.log(generateRunSummary(readResults(dir)));
}

module.exports = {
  readResults,
  generateRunSummary,
  renderTeamDetail,
  renderPassingRow,
  renderIncreaseSummaryLine,
  renderMetricsTable,
  renderDecreasedFilesDetails,
};
