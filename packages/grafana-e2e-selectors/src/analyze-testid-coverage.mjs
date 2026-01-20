#!/usr/bin/env node

/**
 * Script to analyze data-testid coverage in the Grafana codebase
 *
 * This script scans the codebase to determine:
 * - How many components have a data-testid attribute
 * - How many use simple strings (not referencing the selectors package)
 * - How many reference the @grafana/e2e-selectors package
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const DIRECTORIES_TO_SCAN = [
  'public',
  'packages/grafana-alerting',
  'packages/grafana-flamegraph',
  'packages/grafana-011y-ds-frontend',
  'packages/grafana-prometheus',
  'packages/grafana-sql',
  'packages/grafana-ui',
  'packages/grafana-runtime',
  'packages/grafana-data',
];

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const IGNORED_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage'];

// Statistics
const stats = {
  totalFiles: 0,
  filesWithTestId: 0,
  totalTestIds: 0,
  testIdsWithStringLiterals: 0,
  testIdsWithSelectors: 0,
  testIdsWithTemplateStrings: 0,
  testIdsWithVariables: 0,
  filesWithSelectorImport: 0,
};

const results = {
  stringLiterals: [],
  selectorUsages: [],
  templateStrings: [],
  variables: [],
};

/**
 * Recursively get all files in directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORED_DIRS.includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (EXTENSIONS.includes(path.extname(file))) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

/**
 * Analyze a single file for data-testid usage
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(WORKSPACE_ROOT, filePath);

  stats.totalFiles++;

  // Check if file imports selectors
  const hasSelectorImport = content.includes('@grafana/e2e-selectors');
  if (hasSelectorImport) {
    stats.filesWithSelectorImport++;
  }

  // Find all data-testid occurrences
  const testIdRegex = /data-testid\s*=\s*(?:{([^}]+)}|"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
  const matches = [...content.matchAll(testIdRegex)];

  if (matches.length === 0) {
    return;
  }

  stats.filesWithTestId++;

  matches.forEach((match) => {
    stats.totalTestIds++;

    const [fullMatch, jsxExpression, doubleQuote, singleQuote, templateString] = match;

    const result = {
      file: relativePath,
      line: content.substring(0, match.index).split('\n').length,
      match: fullMatch.substring(0, 100), // Limit length
    };

    if (jsxExpression) {
      // JSX expression like {selectors.pages.Login.submit}, {Components.NavToolbar.container}, or {variable}
      const trimmed = jsxExpression.trim();

      // Check for direct selector package usage: selectors., Components., or Pages.
      const isDirectSelectorUsage =
        trimmed.includes('selectors.') ||
        trimmed.startsWith('Components.') ||
        trimmed.includes('Components.') ||
        trimmed.startsWith('Pages.') ||
        trimmed.includes('Pages.');

      // Check if it's a variable that likely references a selector (and file imports selectors)
      const isSelectorVariable =
        hasSelectorImport &&
        (trimmed.includes('Selector') || 
         trimmed.includes('selector') || 
         trimmed.includes('e2eSelectors') ||
         trimmed.includes('testIds') ||
         trimmed.includes('TestIds'));

      if (isDirectSelectorUsage || isSelectorVariable) {
        stats.testIdsWithSelectors++;
        results.selectorUsages.push({ ...result, value: trimmed });
      } else {
        stats.testIdsWithVariables++;
        results.variables.push({ ...result, value: trimmed });
      }
    } else if (doubleQuote || singleQuote) {
      // String literal - check if it contains selector references
      const value = doubleQuote || singleQuote;

      // Check for template string with selector reference like "${selectors.components.Select.menu}"
      if (value.includes('${selectors.') || value.includes('${Components.') || value.includes('${Pages.')) {
        stats.testIdsWithSelectors++;
        results.selectorUsages.push({ ...result, value });
      } else {
        stats.testIdsWithStringLiterals++;
        results.stringLiterals.push({ ...result, value });
      }
    } else if (templateString) {
      // Template string - check if it contains selector references
      if (
        templateString.includes('${selectors.') ||
        templateString.includes('${Components.') ||
        templateString.includes('${Pages.')
      ) {
        stats.testIdsWithSelectors++;
        results.selectorUsages.push({ ...result, value: templateString });
      } else {
        stats.testIdsWithTemplateStrings++;
        results.templateStrings.push({ ...result, value: templateString });
      }
    }
  });
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Analyzing data-testid coverage in Grafana codebase...\n');
  console.log(`Scanning directories: ${DIRECTORIES_TO_SCAN.join(', ')}\n`);

  // Collect all files
  let allFiles = [];
  DIRECTORIES_TO_SCAN.forEach((dir) => {
    const fullPath = path.join(WORKSPACE_ROOT, dir);
    if (fs.existsSync(fullPath)) {
      allFiles = allFiles.concat(getAllFiles(fullPath));
    }
  });

  // Analyze each file
  allFiles.forEach(analyzeFile);

  // Print results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ANALYSIS RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total files scanned:                 ${stats.totalFiles.toLocaleString()}`);
  console.log(
    `Files with data-testid:              ${stats.filesWithTestId.toLocaleString()} (${((stats.filesWithTestId / stats.totalFiles) * 100).toFixed(1)}%)`
  );
  console.log(`Files importing selectors:           ${stats.filesWithSelectorImport.toLocaleString()}\n`);

  console.log(`Total data-testid attributes found:  ${stats.totalTestIds.toLocaleString()}\n`);

  console.log('📈 BREAKDOWN BY TYPE:\n');
  console.log(
    `  ✅ Using selectors package:        ${stats.testIdsWithSelectors.toLocaleString()} (${((stats.testIdsWithSelectors / stats.totalTestIds) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ⚠️  Using string literals:         ${stats.testIdsWithStringLiterals.toLocaleString()} (${((stats.testIdsWithStringLiterals / stats.totalTestIds) * 100).toFixed(1)}%)`
  );
  console.log(
    `   Using other variables:          ${stats.testIdsWithVariables.toLocaleString()} (${((stats.testIdsWithVariables / stats.totalTestIds) * 100).toFixed(1)}%)\n`
  );

  // Calculate coverage score
  const goodCoverage = stats.testIdsWithSelectors;
  const needsImprovement = stats.totalTestIds - goodCoverage;
  const coverageScore = (goodCoverage / stats.totalTestIds) * 100;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 SELECTOR COVERAGE SCORE: ${coverageScore.toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (coverageScore < 50) {
    console.log('❌ Coverage is low. Consider refactoring string literals to use the selectors package.');
  } else if (coverageScore < 80) {
    console.log("⚠️  Coverage is moderate. There's room for improvement.");
  } else {
    console.log('✅ Good coverage! Most data-testid attributes use the selectors package.');
  }

  console.log('\n💡 RECOMMENDATIONS:\n');
  console.log(`  - ${needsImprovement.toLocaleString()} data-testid attributes could be refactored to use selectors`);
  console.log('  - String literals are harder to maintain and refactor');
  console.log('  - The selectors package provides type safety and consistency\n');

  // Optional: Show sample files with issues
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 DETAILED SAMPLES (--verbose mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.stringLiterals.length > 0) {
      console.log(`String Literals (showing first 10 of ${results.stringLiterals.length}):`);
      results.stringLiterals.slice(0, 10).forEach((item) => {
        console.log(`  ${item.file}:${item.line} - "${item.value}"`);
      });
      console.log('');
    }

    if (results.selectorUsages.length > 0) {
      console.log(`Selector Usages (showing first 10 of ${results.selectorUsages.length}):`);
      results.selectorUsages.slice(0, 10).forEach((item) => {
        console.log(`  ${item.file}:${item.line} - {${item.value}}`);
      });
      console.log('');
    }

    if (results.templateStrings.length > 0) {
      console.log(`Template Strings (showing first 10 of ${results.templateStrings.length}):`);
      results.templateStrings.slice(0, 10).forEach((item) => {
        console.log(`  ${item.file}:${item.line} - \`${item.value}\``);
      });
      console.log('');
    }

    if (results.variables.length > 0) {
      console.log(`Other Variables (showing first 10 of ${results.variables.length}):`);
      results.variables.slice(0, 10).forEach((item) => {
        console.log(`  ${item.file}:${item.line} - {${item.value}}`);
      });
      console.log('');
    }
  } else {
    console.log('💡 Run with --verbose or -v flag to see detailed samples\n');
  }

  // Export JSON if requested
  if (process.argv.includes('--json')) {
    const jsonOutput = {
      stats,
      results: {
        stringLiterals: results.stringLiterals,
        selectorUsages: results.selectorUsages,
        templateStrings: results.templateStrings,
        variables: results.variables,
      },
    };

    const outputPath = path.join(WORKSPACE_ROOT, 'testid-coverage-report.json');
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
