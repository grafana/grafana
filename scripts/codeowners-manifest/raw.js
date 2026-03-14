#!/usr/bin/env node

const { OwnershipEngine } = require('github-codeowners/dist/lib/ownership');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { access } = require('node:fs/promises');
const readline = require('node:readline');

const { CODEOWNERS_FILE_PATH, CODEOWNERS_MANIFEST_DIR, RAW_AUDIT_JSONL_PATH } = require('./constants.js');

/**
 * Generate raw CODEOWNERS audit data by streaming `git ls-files` and resolving
 * ownership for each file via OwnershipEngine.
 *
 * @param {string} codeownersPath - Path to CODEOWNERS file
 * @param {string} outputPath - Path to write audit JSONL file
 */
async function generateCodeownersRawAudit(codeownersPath, outputPath) {
  try {
    await access(codeownersPath);
  } catch (error) {
    throw new Error(`CODEOWNERS file not found at: ${codeownersPath}`);
  }

  const engine = OwnershipEngine.FromCodeownersFile(codeownersPath);
  const outputStream = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    const child = spawn('git', ['ls-files'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

    let stderrData = '';
    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    outputStream.on('error', (error) => {
      child.kill();
      reject(new Error(`Failed to write to output file: ${error.message}`));
    });

    rl.on('line', (filePath) => {
      if (!filePath) {
        return;
      }
      const owners = engine.calcFileOwnership(filePath);
      outputStream.write(JSON.stringify({ path: filePath, owners, lines: 0 }) + '\n');
    });

    rl.on('close', () => {
      outputStream.end();
    });

    outputStream.on('finish', () => {
      resolve();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`git ls-files exited with code ${code}`);
        if (stderrData) {
          error.message += `\nStderr: ${stderrData.trim()}`;
        }
        reject(error);
      }
    });

    child.on('error', (err) => {
      outputStream.end();
      reject(err);
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
