#!/usr/bin/env node

/**
 * Phase 1: Discovery & Inventory
 *
 * Scans the codebase to find all menu, toolbar, and form components
 * Generates inventory of components that need data-testid attributes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import _traverse from '@babel/traverse';
import {
  parseFile,
  isTargetComponent,
  hasDataTestId,
  extractTextContent,
  getPropValue,
  getComponentName,
  findParentComponent,
} from './utils/ast-helpers.mjs';

// Handle ES module import
const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const OUTPUT_PATH = path.join(__dirname, 'output/1-inventory.json');

// Load configuration
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const stats = {
  totalFiles: 0,
  totalComponents: 0,
  componentsWithTestId: 0,
  componentsWithoutTestId: 0,
  byType: {
    menu: 0,
    toolbar: 0,
    form: 0,
  },
  byFeatureArea: {},
};

const inventory = [];

/**
 * Determine component category (menu, toolbar, form)
 */
function getComponentCategory(componentName) {
  if (config.targetComponents.menus.includes(componentName)) {
    return 'menu';
  }
  if (config.targetComponents.toolbars.includes(componentName)) {
    return 'toolbar';
  }
  if (config.targetComponents.forms.includes(componentName)) {
    return 'form';
  }
  return null;
}

/**
 * Extract component information
 */
function extractComponentInfo(path, filePath, componentType) {
  const componentName = getComponentName(path);
  const textContent = extractTextContent(path.node.children);
  const ariaLabel = getPropValue(path, 'aria-label');
  const tooltip = getPropValue(path, 'tooltip');
  const label = getPropValue(path, 'label');
  const name = getPropValue(path, 'name');
  const id = getPropValue(path, 'id');
  const placeholder = getPropValue(path, 'placeholder');
  const icon = getPropValue(path, 'icon');
  const type = getPropValue(path, 'type');

  // Try to extract onClick handler name
  let onClick = null;
  const onClickAttr = path.node.openingElement.attributes.find((attr) => attr.name && attr.name.name === 'onClick');
  if (onClickAttr && onClickAttr.value) {
    // Simplified - would need more sophisticated parsing
    onClick = 'handler';
  }

  return {
    filePath,
    lineNumber: path.node.loc.start.line,
    componentName,
    componentType,
    hasTestId: hasDataTestId(path),
    textContent,
    ariaLabel,
    tooltip,
    label,
    name,
    id,
    placeholder,
    icon,
    type,
    onClick,
    parentComponent: findParentComponent(path),
  };
}

/**
 * Analyze a single file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(WORKSPACE_ROOT, filePath);

  stats.totalFiles++;

  let ast;
  try {
    ast = parseFile(content);
  } catch (error) {
    console.error(`Failed to parse ${relativePath}: ${error.message}`);
    return;
  }

  const fileComponents = [];

  // Deduplicate target components
  const allTargets = new Set([
    ...config.targetComponents.menus,
    ...config.targetComponents.toolbars,
    ...config.targetComponents.forms,
  ]);

  traverse(ast, {
    JSXElement(path) {
      const componentName = getComponentName(path);

      // Check if this is a target component
      if (allTargets.has(componentName)) {
        const componentType = getComponentCategory(componentName);

        if (componentType) {
          stats.totalComponents++;
          stats.byType[componentType]++;

          const info = extractComponentInfo(path, relativePath, componentType);

          if (info.hasTestId) {
            stats.componentsWithTestId++;
          } else {
            stats.componentsWithoutTestId++;
            fileComponents.push(info);
          }
        }
      }
    },
  });

  if (fileComponents.length > 0) {
    inventory.push(...fileComponents);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Phase 1: Discovery & Inventory\n');
  console.log('Scanning codebase for menu, toolbar, and form components...\n');

  // Collect all files
  const allFiles = [];

  for (const dir of config.scanDirectories) {
    const fullPath = path.join(WORKSPACE_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Directory not found: ${dir}`);
      continue;
    }

    const pattern = `${fullPath}/**/*.{tsx,ts}`;
    const files = await glob(pattern, {
      ignore: config.excludePatterns.map((p) => path.join(fullPath, p)),
    });

    allFiles.push(...files);
  }

  console.log(`Found ${allFiles.length} files to analyze\n`);

  // Analyze each file
  allFiles.forEach((file, index) => {
    if (index % 100 === 0 && index > 0) {
      console.log(`  Processed ${index}/${allFiles.length} files...`);
    }
    analyzeFile(file);
  });

  console.log(`  Processed ${allFiles.length}/${allFiles.length} files.`);
  console.log(`  Components found during traversal: ${stats.totalComponents}`);

  // Calculate feature area stats
  inventory.forEach((item) => {
    const featureMatch = Object.entries(config.featureAreaMappings).find(([pathPattern]) =>
      item.filePath.includes(pathPattern)
    );
    const area = featureMatch ? featureMatch[1] : 'Other';

    if (!stats.byFeatureArea[area]) {
      stats.byFeatureArea[area] = 0;
    }
    stats.byFeatureArea[area]++;
  });

  // Print results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DISCOVERY RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total files scanned:                 ${stats.totalFiles.toLocaleString()}`);
  console.log(`Total target components found:       ${stats.totalComponents.toLocaleString()}`);
  console.log(
    `  - Already have data-testid:        ${stats.componentsWithTestId.toLocaleString()} (${((stats.componentsWithTestId / stats.totalComponents) * 100).toFixed(1)}%)`
  );
  console.log(
    `  - Need data-testid:                ${stats.componentsWithoutTestId.toLocaleString()} (${((stats.componentsWithoutTestId / stats.totalComponents) * 100).toFixed(1)}%)\n`
  );

  console.log('By Component Type:');
  console.log(`  - Menu components:                 ${stats.byType.menu.toLocaleString()}`);
  console.log(`  - Toolbar components:              ${stats.byType.toolbar.toLocaleString()}`);
  console.log(`  - Form components:                 ${stats.byType.form.toLocaleString()}\n`);

  console.log('By Feature Area:');
  Object.entries(stats.byFeatureArea)
    .sort((a, b) => b[1] - a[1])
    .forEach(([area, count]) => {
      console.log(`  - ${area.padEnd(25)}: ${count.toLocaleString()}`);
    });

  // Save inventory
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    stats,
    inventory,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅ Inventory saved to: ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}`);
  console.log(
    `\n💡 Found ${stats.componentsWithoutTestId.toLocaleString()} components that need data-testid attributes\n`
  );
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
