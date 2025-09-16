#!/usr/bin/env node

const fs = require('node:fs');

const {
  CODEOWNERS_FILE_PATH,
  CODEOWNERS_MANIFEST_DIR,
  RAW_AUDIT_JSONL_PATH,
  CODEOWNERS_BY_FILENAME_JSON_PATH,
  FILENAMES_BY_CODEOWNER_JSON_PATH,
  CODEOWNERS_JSON_PATH,
  METADATA_JSON_PATH
} = require('./constants.js');
const { generateCodeownersManifest } = require('./manifest.js');
const { generateCodeownersMetadata } = require('./metadata.js');
const { generateCodeownersRawAudit } = require('./raw.js');

/**
 * Generate complete codeowners manifest including raw audit, metadata, and processed files
 * @param {string} codeownersFilePath - Path to CODEOWNERS file
 * @param {string} manifestDir - Directory for manifest files
 * @param {string} rawAuditPath - Path for raw audit JSONL file
 * @param {string} codeownersJsonPath - Path for teams.json
 * @param {string} codeownersByFilenamePath - Path for teams-by-filename.json
 * @param {string} filenamesByCodeownerPath - Path for filenames-by-team.json
 * @param {string} metadataPath - Path for metadata.json
 */
async function generateCodeownersManifestComplete(
  codeownersFilePath,
  manifestDir,
  rawAuditPath,
  codeownersJsonPath,
  codeownersByFilenamePath,
  filenamesByCodeownerPath,
  metadataPath
) {
  const hasManifestDirectory = fs.existsSync(manifestDir);
  if (!hasManifestDirectory) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  const newMetadata = generateCodeownersMetadata(codeownersFilePath, manifestDir, 'metadata.json');

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
    await generateCodeownersRawAudit(codeownersFilePath, rawAuditPath);
    await generateCodeownersManifest(rawAuditPath, codeownersJsonPath, codeownersByFilenamePath, filenamesByCodeownerPath);
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
        CODEOWNERS_MANIFEST_DIR,
        RAW_AUDIT_JSONL_PATH,
        CODEOWNERS_JSON_PATH,
        CODEOWNERS_BY_FILENAME_JSON_PATH,
        FILENAMES_BY_CODEOWNER_JSON_PATH,
        METADATA_JSON_PATH
      );

      if (wasGenerated) {
        console.log('✅ Complete manifest generated:');
        console.log(`   • ${CODEOWNERS_MANIFEST_DIR}/`);
      } else {
        console.log('✅ Manifest up-to-date, skipped generation');
      }
    } catch (e) {
      console.error('❌ Error generating codeowners manifest:', e.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateCodeownersManifestComplete };
