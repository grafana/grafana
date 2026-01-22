#!/usr/bin/env node

/**
 * Phase 2: Analyze & Generate Selectors
 *
 * Analyzes the inventory and generates selector definitions
 * Resolves naming conflicts and validates uniqueness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFeatureArea, generateSelectorPath, resolveConflicts, isValidSelectorPath } from './utils/naming-rules.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const INVENTORY_PATH = path.join(__dirname, 'output/1-inventory.json');
const OUTPUT_PATH = path.join(__dirname, 'output/2-selectors.json');

// Load configuration and inventory
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const inventoryData = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

const stats = {
  totalSelectors: 0,
  validSelectors: 0,
  conflicts: 0,
  byType: {
    menu: 0,
    toolbar: 0,
    form: 0,
  },
};

/**
 * Generate selector for a component
 */
function generateSelector(component, index) {
  const featureArea = getFeatureArea(component.filePath, config.featureAreaMappings);

  const componentData = {
    ...component,
    index,
    formContext: null, // Could be enhanced to detect form context
  };

  const selectorPath = generateSelectorPath(componentData, featureArea, component.componentType);

  return {
    selectorPath,
    testIdValue: `data-testid ${selectorPath.replace(/\./g, ' ')}`,
    sourceFile: component.filePath,
    lineNumber: component.lineNumber,
    componentName: component.componentName,
    componentType: component.componentType,
    featureArea,
    description: generateDescription(component),
  };
}

/**
 * Generate human-readable description
 */
function generateDescription(component) {
  const parts = [];

  if (component.textContent) {
    parts.push(`"${component.textContent}"`);
  }

  if (component.ariaLabel) {
    parts.push(`(${component.ariaLabel})`);
  }

  if (component.label) {
    parts.push(`labeled "${component.label}"`);
  }

  const desc = parts.length > 0 ? parts.join(' ') : component.componentName;

  return `Selector for ${component.componentType} component: ${desc}`;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Phase 2: Analyze & Generate Selectors\n');
  console.log(`Processing ${inventoryData.inventory.length} components...\n`);

  // Generate selectors for each component
  const selectors = inventoryData.inventory.map((component, index) => {
    const selector = generateSelector(component, index);
    stats.totalSelectors++;
    stats.byType[component.componentType]++;

    if (isValidSelectorPath(selector.selectorPath)) {
      stats.validSelectors++;
    }

    return selector;
  });

  // Resolve conflicts
  console.log('Resolving naming conflicts...');
  const resolved = resolveConflicts(selectors);
  stats.conflicts = resolved.filter((s) => s.hasConflict).length;

  // Group by feature area
  const grouped = {};
  resolved.forEach((selector) => {
    if (!grouped[selector.featureArea]) {
      grouped[selector.featureArea] = [];
    }
    grouped[selector.featureArea].push(selector);
  });

  // Print results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SELECTOR GENERATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Total selectors generated:           ${stats.totalSelectors.toLocaleString()}`);
  console.log(`  - Valid selector paths:            ${stats.validSelectors.toLocaleString()}`);
  console.log(`  - Naming conflicts resolved:       ${stats.conflicts.toLocaleString()}\n`);

  console.log('By Component Type:');
  console.log(`  - Menu selectors:                  ${stats.byType.menu.toLocaleString()}`);
  console.log(`  - Toolbar selectors:               ${stats.byType.toolbar.toLocaleString()}`);
  console.log(`  - Form selectors:                  ${stats.byType.form.toLocaleString()}\n`);

  console.log('By Feature Area:');
  Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([area, selectorList]) => {
      console.log(`  - ${area.padEnd(25)}: ${selectorList.length.toLocaleString()}`);
    });

  // Show sample selectors
  console.log('\n📝 Sample Generated Selectors:\n');
  const samples = resolved.slice(0, 10);
  samples.forEach((s) => {
    console.log(`  ${s.selectorPath}`);
    console.log(`    → ${s.description}`);
    console.log(`    @ ${s.sourceFile}:${s.lineNumber}\n`);
  });

  // Save selectors
  const output = {
    stats,
    selectors: resolved,
    grouped,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✅ Selectors saved to: ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}`);
  console.log(`\n💡 Generated ${stats.totalSelectors.toLocaleString()} unique selector paths\n`);
}

main();
