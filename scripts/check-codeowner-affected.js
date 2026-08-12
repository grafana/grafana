#!/usr/bin/env node

const CODEOWNERS_MANIFEST_PATH = '../codeowners-manifest/filenames-by-team.json';

/**
 * Checks if any files owned by a codeowner are in the list of changed files
 * @param {string} codeowner - Codeowner name (e.g., '@grafana/dataviz-squad')
 * @param {string[]} changedFiles - Array of changed file paths
 * @param {string} manifestPath - Path to codeowners manifest JSON file
 * @returns {boolean} True if any team files are in the changed files list
 */
function isCodeownerAffected(codeowner, changedFiles, manifestPath = CODEOWNERS_MANIFEST_PATH) {
  const manifest = require(manifestPath);
  const teamFiles = manifest[codeowner] || [];

  if (teamFiles.length === 0) {
    console.warn(`Warning: No files found for codeowner "${codeowner}"`);
    return false;
  }

  return teamFiles.some((file) => changedFiles.includes(file));
}

/**
 * Runs the codeowner affected check from command line
 * @param {string} codeowner - Codeowner name from CLI args
 * @param {string|string[]} changedFiles - Changed file paths (space-separated string or array)
 */
function checkCodeownerAffected(codeowner, changedFiles) {
  if (!codeowner) {
    console.error('Usage: node check-codeowner-affected.js <codeowner> <space-separated-files>');
    console.error('   or: node check-codeowner-affected.js <codeowner> <file1> <file2> ...');
    process.exit(1);
  }

  const filesArray = typeof changedFiles === 'string' ? changedFiles.split(/\s+/).filter(Boolean) : changedFiles;
  const isAffected = isCodeownerAffected(codeowner, filesArray);
  console.log(isAffected ? 'true' : 'false');
}

if (require.main === module) {
  const [codeowner, ...rest] = process.argv.slice(2);
  const changedFiles = rest.length === 1 ? rest[0] : rest;
  checkCodeownerAffected(codeowner, changedFiles);
}

module.exports = { isCodeownerAffected, checkCodeownerAffected };
