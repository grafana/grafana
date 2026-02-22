#!/usr/bin/env node

/**
 * Aggregates coverage summary JSON files into Prometheus metrics format.
 *
 * Usage: node scripts/aggregate-coverage-metrics.js [summaries-dir] [output-file]
 * Defaults: ./coverage/summaries → ./coverage/coverage-metrics.txt
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_SUMMARIES_DIR = './coverage/summaries';
const METRICS_OUTPUT_PATH = './coverage/coverage-metrics.txt';
const PACKAGE_NAME = '@grafana/grafana';

/**
 * Aggregates coverage metrics from JSON files to Prometheus format
 * @param {string} summariesDir - Directory containing coverage summaries
 * @param {string} outputPath - Path to output metrics file
 * @throws {Error} If no coverage files found, invalid file format, or write fails
 */
function aggregateCoverageMetricsFromFiles(summariesDir = COVERAGE_SUMMARIES_DIR, outputPath = METRICS_OUTPUT_PATH) {
  const coverageData = readCoverageDataFromDirectory(summariesDir);
  const metricsContent = generatePrometheusMetrics(coverageData);
  writeMetricsFile(outputPath, metricsContent);
}

/**
 * Reads coverage summary files from directory
 * @param {string} summariesDir - Directory containing coverage summaries
 * @returns {Array<Object>} Normalized coverage data
 * @throws {Error} If no coverage files found or directory cannot be read
 */
function readCoverageDataFromDirectory(summariesDir) {
  const summaryFiles = findCoverageSummaryFiles(summariesDir);

  if (summaryFiles.length === 0) {
    throw new Error(
      `No coverage-summary.json files found in ${summariesDir}. Please ensure coverage summaries are present in subdirectories`
    );
  }

  console.log(`Found ${summaryFiles.length} coverage summary file(s)`);

  return summaryFiles.map(parseCoverageSummary);
}

/**
 * Converts coverage data to Prometheus metrics format
 * @param {Array<Object>} coverageDataByCodeowner - Coverage data array
 * @returns {string} Prometheus text exposition format
 */
function generatePrometheusMetrics(coverageDataByCodeowner) {
  const lineMetrics = coverageDataByCodeowner.map((d) => ({
    codeowner: d.codeowner,
    value: d.summary.lines.pct,
    timestamp: d.timestamp,
  }));

  const branchMetrics = coverageDataByCodeowner.map((d) => ({
    codeowner: d.codeowner,
    value: d.summary.branches.pct,
    timestamp: d.timestamp,
  }));

  const functionMetrics = coverageDataByCodeowner.map((d) => ({
    codeowner: d.codeowner,
    value: d.summary.functions.pct,
    timestamp: d.timestamp,
  }));

  const statementMetrics = coverageDataByCodeowner.map((d) => ({
    codeowner: d.codeowner,
    value: d.summary.statements.pct,
    timestamp: d.timestamp,
  }));

  const metricBlocks = [
    generateMetricBlock('grafana_frontend_line_coverage_percent', 'Line test coverage percentage', lineMetrics),
    generateMetricBlock('grafana_frontend_branch_coverage_percent', 'Branch test coverage percentage', branchMetrics),
    generateMetricBlock(
      'grafana_frontend_function_coverage_percent',
      'Function test coverage percentage',
      functionMetrics
    ),
    generateMetricBlock(
      'grafana_frontend_statement_coverage_percent',
      'Statement test coverage percentage',
      statementMetrics
    ),
  ];

  return metricBlocks.join('\n\n') + '\n';
}

/**
 * Writes metrics to file
 * @param {string} outputPath - Output file path
 * @param {string} content - Metrics content
 * @throws {Error} If file cannot be written
 */
function writeMetricsFile(outputPath, content) {
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`✅ Coverage metrics written to ${outputPath}`);
}

/**
 * Finds coverage-summary.json files in immediate subdirectories
 * @param {string} dir - Directory to search
 * @returns {string[]} File paths
 * @throws {Error} If directory cannot be read
 */
function findCoverageSummaryFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.map((entry) => findCoverageSummaryInEntry(dir, entry)).filter((path) => path !== null);
}

/**
 * Parses coverage summary file
 * @param {string} filePath - Coverage summary file path
 * @returns {Object} Normalized coverage data
 * @throws {Error} If file cannot be read or format is invalid
 */
function parseCoverageSummary(filePath) {
  const data = readCoverageSummary(filePath);

  if (!data.summary || !data.team || !data.timestamp) {
    throw new Error(`Invalid coverage summary format in ${filePath}`);
  }

  return {
    codeowner: data.team,
    timestamp: convertToUnixMilliseconds(data.timestamp),
    summary: data.summary,
  };
}

/**
 * Generates Prometheus metric block for a metric type
 * @param {string} metricName - Metric name
 * @param {string} helpText - HELP text
 * @param {Array<Object>} codeowners - Codeowner data with codeowner, value, timestamp
 * @returns {string} Prometheus formatted metrics
 */
function generateMetricBlock(metricName, helpText, codeowners) {
  const header = [`# HELP ${metricName} ${helpText}`, `# TYPE ${metricName} gauge`];

  const metricLines = codeowners.map((codeowner) => formatMetricLine(metricName, codeowner));

  return [...header, ...metricLines].join('\n');
}

/**
 * Checks if directory entry contains coverage-summary.json
 * @param {string} dir - Parent directory path
 * @param {fs.Dirent} entry - Directory entry
 * @returns {string|null} Coverage summary path or null
 */
function findCoverageSummaryInEntry(dir, entry) {
  if (!entry.isDirectory()) {
    return null;
  }

  const fullPath = path.join(dir, entry.name);
  const summaryPath = path.join(fullPath, 'coverage-summary.json');

  return fs.existsSync(summaryPath) ? summaryPath : null;
}

/**
 * Reads and parses coverage summary JSON file
 * @param {string} filePath - Coverage summary file path
 * @returns {Object} Parsed coverage data
 * @throws {Error} If file cannot be read or JSON is invalid
 */
function readCoverageSummary(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Converts ISO timestamp to Unix milliseconds
 * @param {string} isoTimestamp - ISO 8601 timestamp
 * @returns {number} Unix milliseconds
 * @throws {Error} If timestamp is invalid
 */
function convertToUnixMilliseconds(isoTimestamp) {
  const timestamp = new Date(isoTimestamp).getTime();
  if (isNaN(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${isoTimestamp}`);
  }
  return timestamp;
}

/**
 * Formats codeowner coverage as Prometheus metric line
 * @param {string} metricName - Metric name
 * @param {Object} codeowner - Codeowner data
 * @returns {string} Prometheus metric line
 */
function formatMetricLine(metricName, codeowner) {
  return `${metricName}{codeowner="${codeowner.codeowner}",package="${PACKAGE_NAME}"} ${codeowner.value} ${codeowner.timestamp}`;
}

if (require.main === module) {
  const summariesDir = process.argv[2] || COVERAGE_SUMMARIES_DIR;
  const outputPath = process.argv[3] || METRICS_OUTPUT_PATH;

  try {
    aggregateCoverageMetricsFromFiles(summariesDir, outputPath);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  readCoverageDataFromDirectory,
  generatePrometheusMetrics,
  aggregateCoverageMetricsFromFiles,
};
