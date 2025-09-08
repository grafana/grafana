#!/usr/bin/env node

const { execSync } = require('node:child_process');
const fs = require('node:fs');

const CODEOWNERS_FILE_PATH = '.github/CODEOWNERS';
const CODEOWNERS_MANIFEST_DIR = 'codeowners-manifest';
const CODEOWNERS_MANIFEST_METADATA_FILENAME = `${CODEOWNERS_MANIFEST_DIR}/metadata.json`;

/**
 * @typedef {Object} CodeownersMetadata
 * @property {string} generatedAt - ISO timestamp when metadata was generated
 * @property {string} filesHash - SHA-256 hash of all repository files
 * @property {string} codeownersHash - SHA-256 hash of CODEOWNERS file
 */

/**
 * Generate codeowners metadata for caching
 * @param {string} codeownersFilePath - Path to CODEOWNERS file
 * @param {string} manifestDir - Directory for manifest files
 * @param {string} metadataFilename - Filename for metadata file
 * @returns {CodeownersMetadata} Metadata object with hashes
 */
function generateCodeownersMetadata(codeownersFilePath, manifestDir, metadataFilename) {
  const [filesHash] = execSync('git ls-files | sort | sha256sum', { encoding: 'utf8' }).trim().split(' ');

  const [codeownersHash] = execSync(`sha256sum "${codeownersFilePath}"`, { encoding: 'utf8' }).trim().split(' ');

  return {
    generatedAt: new Date().toISOString(),
    filesHash,
    codeownersHash,
  };
}

if (require.main === module) {
  try {
    console.log('⚙️ Generating codeowners-manifest metadata ...');

    if (!fs.existsSync(CODEOWNERS_MANIFEST_DIR)) {
      fs.mkdirSync(CODEOWNERS_MANIFEST_DIR, { recursive: true });
    }

    const metadata = generateCodeownersMetadata(
      CODEOWNERS_FILE_PATH,
      CODEOWNERS_MANIFEST_DIR,
      CODEOWNERS_MANIFEST_METADATA_FILENAME
    );

    console.log(`🗂️ Files list hash: ${metadata.filesHash}`);
    console.log(`📜 CODEOWNERS hash: ${metadata.codeownersHash}`);

    fs.writeFileSync(CODEOWNERS_MANIFEST_METADATA_FILENAME, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`💾 Metadata written to: ${CODEOWNERS_MANIFEST_METADATA_FILENAME}`);
  } catch (error) {
    console.error('❌ Error generating codeowners metadata:', error.message);
    process.exit(1);
  }
}

module.exports = { generateCodeownersMetadata };
