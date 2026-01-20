#!/usr/bin/env node

/**
 * Script to analyze reftarget coverage in Grafana Pathfinder interactive tutorials
 *
 * This script scans the bundled-interactives directory to determine:
 * - How many reftargets are defined
 * - How many use selectors from @grafana/e2e-selectors
 * - How many use custom selectors (not from the package)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

// Get directory from command line argument (required)
const dirArgIndex = process.argv.findIndex((arg) => arg === '--dir' || arg === '-d');
if (dirArgIndex === -1 || !process.argv[dirArgIndex + 1]) {
  console.error('❌ Error: --dir or -d flag is required');
  console.error('\nUsage:');
  console.error('  node analyze-reftarget-coverage.mjs --dir <path>');
  console.error('  node analyze-reftarget-coverage.mjs -d <path>');
  console.error('\nOptions:');
  console.error('  --dir, -d <path>    Path to interactive tutorials directory (required)');
  console.error('  --verbose, -v       Show detailed samples');
  console.error('  --by-file, -f       Show breakdown by file');
  console.error('  --json              Export results to JSON file');
  process.exit(1);
}

const interactivesPath = process.argv[dirArgIndex + 1];
const INTERACTIVES_DIR = path.isAbsolute(interactivesPath)
  ? interactivesPath
  : path.join(WORKSPACE_ROOT, interactivesPath);

// Statistics
const stats = {
  totalFiles: 0,
  totalReftargets: 0,
  reftargetsWithSelectors: 0,
  reftargetsWithoutSelectors: 0,
  reftargetsWithDataTestId: 0,
  reftargetsWithCustomSelectors: 0,
};

const results = {
  withSelectors: [],
  withoutSelectors: [],
  allReftargets: [],
};

/**
 * Recursively get all JSON files in directory
 */
function getAllJsonFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllJsonFiles(fullPath, arrayOfFiles);
    } else if (path.extname(file) === '.json') {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

/**
 * Extract all reftargets from a JSON object recursively
 */
function extractReftargets(obj, filePath, reftargets = []) {
  if (!obj || typeof obj !== 'object') {
    return reftargets;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractReftargets(item, filePath, reftargets));
    return reftargets;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'reftarget' && typeof value === 'string') {
      reftargets.push({
        filePath,
        reftarget: value,
        context: obj,
      });
    } else if (typeof value === 'object') {
      extractReftargets(value, filePath, reftargets);
    }
  }

  return reftargets;
}

/**
 * Determine if a reftarget uses the e2e-selectors package
 */
function usesE2ESelector(reftarget) {
  // Check for common patterns that indicate e2e-selector usage

  // Pattern 1: grafana:components. or grafana:pages.
  if (reftarget.startsWith('grafana:components.') || reftarget.startsWith('grafana:pages.')) {
    return {
      uses: true,
      type: 'grafana-prefix',
      selector: reftarget,
    };
  }

  // Pattern 2: CSS selector with data-testid attribute
  const dataTestIdMatch = reftarget.match(/data-testid\s*=\s*['"](.*?)['"]/);
  if (dataTestIdMatch) {
    const testId = dataTestIdMatch[1];

    // Check if it looks like a selector from the package (contains specific patterns)
    const looksLikePackageSelector =
      testId.includes('data-testid ') || // e.g., "data-testid Nav menu item"
      /^[A-Z]/.test(testId) || // Starts with capital letter
      (testId.includes('-') && !testId.startsWith('data-testid')); // kebab-case but not our prefix

    return {
      uses: looksLikePackageSelector,
      type: 'data-testid',
      selector: testId,
    };
  }

  // Pattern 3: Plain text button/link labels (these are custom selectors)
  if (!reftarget.includes('[') && !reftarget.includes('.') && !reftarget.includes('#')) {
    return {
      uses: false,
      type: 'text-label',
      selector: reftarget,
    };
  }

  // Pattern 4: Custom CSS selectors
  return {
    uses: false,
    type: 'css-selector',
    selector: reftarget,
  };
}

/**
 * Analyze a single JSON file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(WORKSPACE_ROOT, filePath);

  stats.totalFiles++;

  let data;
  try {
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing ${relativePath}: ${error.message}`);
    return;
  }

  const reftargets = extractReftargets(data, relativePath);

  reftargets.forEach(({ filePath, reftarget, context }) => {
    stats.totalReftargets++;

    const analysis = usesE2ESelector(reftarget);

    const result = {
      file: filePath,
      reftarget,
      type: analysis.type,
      action: context.action || 'unknown',
    };

    results.allReftargets.push(result);

    if (analysis.uses) {
      stats.reftargetsWithSelectors++;
      results.withSelectors.push(result);

      if (analysis.type === 'data-testid') {
        stats.reftargetsWithDataTestId++;
      }
    } else {
      stats.reftargetsWithoutSelectors++;
      results.withoutSelectors.push(result);

      if (analysis.type === 'css-selector') {
        stats.reftargetsWithCustomSelectors++;
      }
    }
  });
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Analyzing reftarget coverage in Grafana Pathfinder interactives...\n');
  console.log(`Scanning directory: ${path.relative(WORKSPACE_ROOT, INTERACTIVES_DIR)}\n`);

  if (!fs.existsSync(INTERACTIVES_DIR)) {
    console.error(`❌ Directory not found: ${INTERACTIVES_DIR}`);
    process.exit(1);
  }

  // Collect all JSON files
  const allFiles = getAllJsonFiles(INTERACTIVES_DIR);

  // Analyze each file
  allFiles.forEach(analyzeFile);

  // Print results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ANALYSIS RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total JSON files scanned:            ${stats.totalFiles.toLocaleString()}`);
  console.log(`Total reftargets found:              ${stats.totalReftargets.toLocaleString()}\n`);

  console.log('📈 BREAKDOWN BY SELECTOR TYPE:\n');
  console.log(
    `  ✅ Using e2e-selectors package:    ${stats.reftargetsWithSelectors.toLocaleString()} (${((stats.reftargetsWithSelectors / stats.totalReftargets) * 100).toFixed(1)}%)`
  );
  console.log(
    `     - Via grafana: prefix:          ${results.withSelectors.filter((r) => r.type === 'grafana-prefix').length.toLocaleString()}`
  );
  console.log(`     - Via data-testid attribute:    ${stats.reftargetsWithDataTestId.toLocaleString()}`);
  console.log(
    `  ⚠️  Not using e2e-selectors:       ${stats.reftargetsWithoutSelectors.toLocaleString()} (${((stats.reftargetsWithoutSelectors / stats.totalReftargets) * 100).toFixed(1)}%)`
  );
  console.log(
    `     - Text labels:                  ${results.withoutSelectors.filter((r) => r.type === 'text-label').length.toLocaleString()}`
  );
  console.log(`     - Custom CSS selectors:         ${stats.reftargetsWithCustomSelectors.toLocaleString()}\n`);

  // Calculate coverage score
  const coverageScore = (stats.reftargetsWithSelectors / stats.totalReftargets) * 100;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 E2E SELECTOR COVERAGE SCORE: ${coverageScore.toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (coverageScore < 30) {
    console.log('❌ Coverage is very low. Most reftargets use custom selectors.');
  } else if (coverageScore < 60) {
    console.log('⚠️  Coverage is moderate. Consider migrating to e2e-selectors package.');
  } else {
    console.log('✅ Good coverage! Most reftargets use the e2e-selectors package.');
  }

  console.log('\n💡 RECOMMENDATIONS:\n');
  console.log(
    `  - ${stats.reftargetsWithoutSelectors.toLocaleString()} reftargets could be refactored to use e2e-selectors`
  );
  console.log('  - Custom selectors are more fragile and harder to maintain');
  console.log('  - The e2e-selectors package provides consistency across tutorials and tests\n');

  // Breakdown by file
  if (process.argv.includes('--by-file') || process.argv.includes('-f')) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📁 BREAKDOWN BY FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const fileStats = {};
    results.allReftargets.forEach((item) => {
      if (!fileStats[item.file]) {
        fileStats[item.file] = {
          total: 0,
          withSelectors: 0,
          withoutSelectors: 0,
        };
      }
      fileStats[item.file].total++;
      if (results.withSelectors.some((r) => r.file === item.file && r.reftarget === item.reftarget)) {
        fileStats[item.file].withSelectors++;
      } else {
        fileStats[item.file].withoutSelectors++;
      }
    });

    Object.entries(fileStats)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([file, stats]) => {
        const coverage = (stats.withSelectors / stats.total) * 100;
        const icon = coverage >= 60 ? '✅' : coverage >= 30 ? '⚠️ ' : '❌';
        console.log(`${icon} ${file}`);
        console.log(
          `   Total: ${stats.total}, Using selectors: ${stats.withSelectors} (${coverage.toFixed(0)}%), Custom: ${stats.withoutSelectors}`
        );
      });
    console.log('');
  }

  // Optional: Show sample reftargets
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 DETAILED SAMPLES (--verbose mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.withoutSelectors.length > 0) {
      console.log(`Custom Selectors (showing first 15 of ${results.withoutSelectors.length}):`);
      results.withoutSelectors.slice(0, 15).forEach((item) => {
        console.log(`  ${item.file}`);
        console.log(`    Type: ${item.type}, Action: ${item.action}`);
        console.log(`    Reftarget: "${item.reftarget.substring(0, 80)}${item.reftarget.length > 80 ? '...' : ''}"`);
      });
      console.log('');
    }

    if (results.withSelectors.length > 0) {
      console.log(`E2E Selector Usages (showing first 15 of ${results.withSelectors.length}):`);
      results.withSelectors.slice(0, 15).forEach((item) => {
        console.log(`  ${item.file}`);
        console.log(`    Type: ${item.type}, Action: ${item.action}`);
        console.log(`    Reftarget: "${item.reftarget.substring(0, 80)}${item.reftarget.length > 80 ? '...' : ''}"`);
      });
      console.log('');
    }
  } else {
    console.log('💡 Run with --verbose or -v flag to see detailed samples');
    console.log('💡 Run with --by-file or -f flag to see breakdown by file');
    console.log('💡 Run with --dir <path> or -d <path> to specify a custom directory\n');
  }

  // Export JSON if requested
  if (process.argv.includes('--json')) {
    const jsonOutput = {
      stats,
      results: {
        withSelectors: results.withSelectors,
        withoutSelectors: results.withoutSelectors,
      },
    };

    const outputPath = path.join(WORKSPACE_ROOT, 'reftarget-coverage-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`📄 JSON report saved to: ${path.relative(WORKSPACE_ROOT, outputPath)}\n`);
  }
}

// Run the script
try {
  main();
} catch (error) {
  console.error('❌ Error during analysis:', error);
  process.exit(1);
}
