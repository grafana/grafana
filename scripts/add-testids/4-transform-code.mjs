#!/usr/bin/env node

/**
 * Phase 4: Transform Source Code
 *
 * Modifies source files to add data-testid attributes
 * This is the most critical phase - runs in DRY RUN mode by default
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import _traverse from '@babel/traverse';
import {
  parseFile,
  generateCode,
  createDataTestIdAttribute,
  addE2ESelectorsImport,
  hasDataTestId,
  getComponentName,
} from './utils/ast-helpers.mjs';

// Handle ES module import
const traverse = _traverse.default || _traverse;
import {
  writeFileWithBackup,
  formatWithPrettier,
  runESLintFix,
  writeJsonReport,
  createDiff,
  restoreFromBackup,
} from './utils/file-writer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const SELECTORS_PATH = path.join(__dirname, 'output/2-selectors.json');
const OUTPUT_PATH = path.join(__dirname, 'output/4-transform-report.json');

// Load selectors
const selectorsData = JSON.parse(fs.readFileSync(SELECTORS_PATH, 'utf8'));

// Command line flags
const DRY_RUN = !process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

const stats = {
  filesProcessed: 0,
  filesModified: 0,
  filesFailed: 0,
  componentsUpdated: 0,
  importsAdded: 0,
};

const results = {
  modified: [],
  failed: [],
  diffs: [],
};

/**
 * Build lookup map: filePath -> selectors
 */
function buildFileMap(selectors) {
  const map = new Map();

  selectors.forEach((selector) => {
    const fullPath = path.join(WORKSPACE_ROOT, selector.sourceFile);

    if (!map.has(fullPath)) {
      map.set(fullPath, []);
    }

    map.get(fullPath).push(selector);
  });

  return map;
}

/**
 * Transform a single file
 */
async function transformFile(filePath, selectorsForFile) {
  const relativePath = path.relative(WORKSPACE_ROOT, filePath);

  if (VERBOSE) {
    console.log(`\n  Processing: ${relativePath}`);
  }

  stats.filesProcessed++;

  // Read file
  const content = fs.readFileSync(filePath, 'utf8');

  // Parse
  let ast;
  try {
    ast = parseFile(content);
  } catch (error) {
    stats.filesFailed++;
    results.failed.push({
      file: relativePath,
      error: `Parse error: ${error.message}`,
    });
    return false;
  }

  // Track modifications
  let modified = false;
  let componentsUpdated = 0;

  // Build lookup by line number
  const selectorsByLine = new Map();
  selectorsForFile.forEach((sel) => {
    selectorsByLine.set(sel.lineNumber, sel);
  });

  // Transform AST
  traverse(ast, {
    JSXElement(path) {
      const lineNumber = path.node.loc.start.line;
      const selector = selectorsByLine.get(lineNumber);

      if (selector && !hasDataTestId(path)) {
        // Add data-testid attribute
        const attribute = createDataTestIdAttribute(selector.selectorPath);
        path.node.openingElement.attributes.push(attribute);

        modified = true;
        componentsUpdated++;

        if (VERBOSE) {
          console.log(`    + Added testid to ${getComponentName(path)} at line ${lineNumber}`);
        }
      }
    },
  });

  if (!modified) {
    return false;
  }

  // Add import if needed
  const needsImport = componentsUpdated > 0;
  if (needsImport) {
    addE2ESelectorsImport(ast, 'Components');
    stats.importsAdded++;

    if (VERBOSE) {
      console.log(`    + Added Components import`);
    }
  }

  // Generate new code
  const newCode = generateCode(ast);

  // Store diff for review
  if (DRY_RUN) {
    results.diffs.push({
      file: relativePath,
      componentsUpdated,
      preview: newCode.split('\n').slice(0, 50).join('\n'),
    });
  } else {
    // Actually write the file
    try {
      const backupPath = await writeFileWithBackup(filePath, newCode);

      // Format
      await formatWithPrettier(filePath);
      await runESLintFix(filePath);

      results.modified.push({
        file: relativePath,
        componentsUpdated,
        backupPath: path.relative(WORKSPACE_ROOT, backupPath),
      });
    } catch (error) {
      // Restore backup on error
      restoreFromBackup(filePath);

      stats.filesFailed++;
      results.failed.push({
        file: relativePath,
        error: `Write error: ${error.message}`,
      });
      return false;
    }
  }

  stats.filesModified++;
  stats.componentsUpdated += componentsUpdated;

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Phase 4: Transform Source Code\n');

  if (DRY_RUN) {
    console.log('🔶 DRY RUN MODE - No files will be modified');
    console.log('   Run with --apply flag to actually update files\n');
  } else {
    console.log('⚠️  APPLY MODE - Files will be modified!');
    console.log('   Backups will be created with .backup extension\n');

    // Confirmation prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise((resolve) => {
      rl.question('Continue? (yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
          console.log('\nAborted.');
          process.exit(0);
        }
        resolve();
      });
    });
    console.log('');
  }

  // Build file map
  const fileMap = buildFileMap(selectorsData.selectors);
  console.log(`Found ${fileMap.size} files to process\n`);

  // Process each file
  let index = 0;
  for (const [filePath, selectors] of fileMap.entries()) {
    index++;

    if (index % 10 === 0) {
      console.log(`  Progress: ${index}/${fileMap.size} files...`);
    }

    await transformFile(filePath, selectors);
  }

  // Print results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TRANSFORMATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Files processed:                     ${stats.filesProcessed.toLocaleString()}`);
  console.log(`Files modified:                      ${stats.filesModified.toLocaleString()}`);
  console.log(`Files failed:                        ${stats.filesFailed.toLocaleString()}`);
  console.log(`Components updated:                  ${stats.componentsUpdated.toLocaleString()}`);
  console.log(`Imports added:                       ${stats.importsAdded.toLocaleString()}\n`);

  if (results.failed.length > 0) {
    console.log('❌ Failed Files:\n');
    results.failed.forEach((fail) => {
      console.log(`  - ${fail.file}`);
      console.log(`    Error: ${fail.error}\n`);
    });
  }

  if (DRY_RUN && results.diffs.length > 0) {
    console.log('📝 Sample Changes (first 5 files):\n');
    results.diffs.slice(0, 5).forEach((diff) => {
      console.log(`  ${diff.file} (${diff.componentsUpdated} components)`);
      console.log('  ' + '-'.repeat(60));
      console.log(
        diff.preview
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')
      );
      console.log('  ...\n');
    });
  }

  // Save report
  const report = {
    mode: DRY_RUN ? 'dry-run' : 'applied',
    stats,
    results: DRY_RUN ? { diffs: results.diffs, failed: results.failed } : results,
    generatedAt: new Date().toISOString(),
  };

  writeJsonReport(OUTPUT_PATH, report);

  console.log(`✅ Report saved to: ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}\n`);

  if (DRY_RUN) {
    console.log('💡 NEXT STEPS:\n');
    console.log('1. Review the changes in output/4-transform-report.json');
    console.log('2. Run with --apply flag to actually modify files');
    console.log('3. Review git diff and test the changes');
    console.log('4. Commit with: git commit -m "feat(testid): add selectors to components"\n');
  } else {
    console.log('✅ Files have been modified!\n');
    console.log('💡 NEXT STEPS:\n');
    console.log('1. Review changes: git diff');
    console.log('2. Run tests: yarn test');
    console.log('3. Build: yarn build');
    console.log('4. If issues, restore backups: find . -name "*.backup"');
    console.log('5. Commit changes when satisfied\n');
  }
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
