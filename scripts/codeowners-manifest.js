#!/usr/bin/env node

const fs = require('node:fs');

const { generateCodeownersManifest } = require('./generate-codeowners-manifest.js');
const { generateCodeownersMetadata } = require('./generate-codeowners-metadata.js');
const { generateCodeownersRawAudit } = require('./generate-codeowners-raw-audit.js');

const CODEOWNERS_FILE_PATH = '.github/CODEOWNERS';
const CODEOWNERS_COVERAGE_DIR = 'codeowners-manifest';
const RAW_AUDIT_JSONL_PATH = `${CODEOWNERS_COVERAGE_DIR}/audit-raw.jsonl`;
const TEAMS_BY_FILENAME_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams-by-filename.json`;
const FILENAMES_BY_TEAM_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/filenames-by-team.json`;
const TEAMS_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams.json`;
const METADATA_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/metadata.json`;

/**
 * Generate complete codeowners manifest including raw audit, metadata, and processed files
 * @param {string} codeownersPath - Path to CODEOWNERS file
 * @param {string} manifestDir - Directory for manifest files
 * @param {string} rawAuditPath - Path for raw audit JSONL file
 * @param {string} teamsPath - Path for teams.json
 * @param {string} teamsByFilenamePath - Path for teams-by-filename.json
 * @param {string} filenamesByTeamPath - Path for filenames-by-team.json
 * @param {string} metadataPath - Path for metadata.json
 */
async function generateCodeownersManifestComplete(
  codeownersPath,
  manifestDir,
  rawAuditPath,
  teamsPath,
  teamsByFilenamePath,
  filenamesByTeamPath,
  metadataPath
) {
  const hasManifestDirectory = fs.existsSync(manifestDir);
  if (!hasManifestDirectory) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  const newMetadata = generateCodeownersMetadata(codeownersPath, manifestDir, 'metadata.json');

  let isCacheUpToDate = false;
  const hasExistingMetadata = fs.existsSync(metadataPath);
  if (hasExistingMetadata) {
    try {
      const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (
        existingMetadata.filesHash === newMetadata.filesHash &&
        existingMetadata.codeownersHash === newMetadata.codeownersHash
      ) {
        isCacheUpToDate = true;
      }
    } catch (error) {
      isCacheUpToDate = false;
    }
  }

  if (!isCacheUpToDate) {
    await generateCodeownersRawAudit(codeownersPath, rawAuditPath);
    await generateCodeownersManifest(rawAuditPath, teamsPath, teamsByFilenamePath, filenamesByTeamPath);
    fs.writeFileSync(metadataPath, JSON.stringify(newMetadata, null, 2), 'utf8');
    return true;
  }

  return false;
}

if (require.main === module) {
  (async () => {
    try {
      console.log('📋 Generating complete codeowners manifest...');

      const wasGenerated = await generateCodeownersManifestComplete(
        CODEOWNERS_FILE_PATH,
        CODEOWNERS_COVERAGE_DIR,
        RAW_AUDIT_JSONL_PATH,
        TEAMS_JSON_PATH,
        TEAMS_BY_FILENAME_JSON_PATH,
        FILENAMES_BY_TEAM_JSON_PATH,
        METADATA_JSON_PATH
      );

      if (wasGenerated) {
        console.log('✅ Complete codeowners manifest generation finished');
      } else {
        console.log('✅ Manifest is up-to-date, skipped generation');
      }
    } catch (e) {
      console.error('❌ Error generating codeowners manifest:', e.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateCodeownersManifestComplete };
