import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Write content to file with backup
 */
export async function writeFileWithBackup(filePath, content) {
  // Create backup
  const backupPath = `${filePath}.backup`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  // Write new content
  fs.writeFileSync(filePath, content, 'utf8');

  return backupPath;
}

/**
 * Format file with Prettier
 */
export async function formatWithPrettier(filePath) {
  try {
    await execAsync(`npx prettier --write "${filePath}"`);
    return true;
  } catch (error) {
    console.warn(`Failed to format ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Run ESLint auto-fix
 */
export async function runESLintFix(filePath) {
  try {
    await execAsync(`npx eslint --fix "${filePath}"`);
    return true;
  } catch (error) {
    // ESLint returns non-zero even with auto-fixable errors
    return false;
  }
}

/**
 * Validate TypeScript compilation
 */
export async function validateTypeScript(filePath) {
  try {
    await execAsync(`npx tsc --noEmit "${filePath}"`);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: error.stdout ? error.stdout.split('\n') : [error.message],
    };
  }
}

/**
 * Write JSON report
 */
export function writeJsonReport(outputPath, data) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Write markdown report
 */
export function writeMarkdownReport(outputPath, content) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, 'utf8');
}

/**
 * Create diff of changes
 */
export async function createDiff(originalPath, modifiedPath) {
  try {
    const { stdout } = await execAsync(`git diff --no-index "${originalPath}" "${modifiedPath}"`);
    return stdout;
  } catch (error) {
    // git diff returns non-zero when files differ
    return error.stdout || '';
  }
}

/**
 * Restore from backup
 */
export function restoreFromBackup(filePath) {
  const backupPath = `${filePath}.backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    return true;
  }
  return false;
}

/**
 * Clean up backups
 */
export function cleanupBackups(directory) {
  const backups = fs.readdirSync(directory, { recursive: true }).filter((file) => file.endsWith('.backup'));

  backups.forEach((backup) => {
    fs.unlinkSync(path.join(directory, backup));
  });

  return backups.length;
}
