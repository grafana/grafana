#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');

const {
  CODEOWNERS_FILE_PATH,
  CODEOWNERS_MANIFEST_DIR,
  RAW_AUDIT_JSONL_PATH
} = require('./constants.js');

/**
 * Generate raw CODEOWNERS audit data using github-codeowners CLI
 * @param {string} codeownersPath - Path to CODEOWNERS file
 * @param {string} outputPath - Path to write audit JSONL file
 */
async function generateCodeownersRawAudit(codeownersPath, outputPath) {
  const hasCodeowners = fs.existsSync(codeownersPath);
  if (!hasCodeowners) {
    throw new Error(`CODEOWNERS file not found at: ${codeownersPath}`);
  }

  return new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(outputPath);

    const child = spawn('yarn', ['github-codeowners', 'audit', '--output', 'jsonl'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      shell: true,
    });

    let stderrData = '';
    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.stdout.pipe(outputStream);

    child.on('close', (code) => {
      outputStream.end();
      if (code === 0) {
        resolve();
      } else {
        const error = new Error(`github-codeowners process exited with code ${code}`);
        if (stderrData) {
          error.message += `\nStderr: ${stderrData.trim()}`;
        }
        reject(error);
      }
    });

    child.on('error', (err) => {
      outputStream.end();
      if (err.code === 'ENOENT') {
        reject(new Error('yarn command not found. Please ensure yarn and github-codeowners are available'));
      } else {
        reject(err);
      }
    });
  });
}

if (require.main === module) {
  (async () => {
    try {
      if (!fs.existsSync(CODEOWNERS_MANIFEST_DIR)) {
        fs.mkdirSync(CODEOWNERS_MANIFEST_DIR, { recursive: true });
      }

      console.log(`🍣 Getting raw CODEOWNERS data for manifest ...`);
      await generateCodeownersRawAudit(CODEOWNERS_FILE_PATH, RAW_AUDIT_JSONL_PATH);
      console.log('✅ Raw audit generated:');
      console.log(`   • ${RAW_AUDIT_JSONL_PATH}`);
    } catch (e) {
      console.error('❌ Error generating raw audit:', e.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateCodeownersRawAudit };
