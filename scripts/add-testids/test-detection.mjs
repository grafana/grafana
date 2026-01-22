#!/usr/bin/env node

/**
 * Test script to debug component detection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFile, getComponentName } from './utils/ast-helpers.mjs';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test with a known file that should have components
const testFiles = [
  '/home/robbymilo/grafana/grafana/public/app/core/components/Login/PasswordlessConfirmationForm.tsx',
  '/home/robbymilo/grafana/grafana/packages/grafana-ui/src/components/Button/Button.tsx',
];

testFiles.forEach((testFile) => {
  if (!fs.existsSync(testFile)) {
    console.log(`❌ File not found: ${testFile}`);
    return;
  }

  console.log(`\n📄 Testing: ${testFile}`);

  const content = fs.readFileSync(testFile, 'utf8');

  try {
    const ast = parseFile(content);
    console.log('✅ Parsed successfully');

    let jsxCount = 0;
    let buttonCount = 0;
    let inputCount = 0;

    traverse(ast, {
      JSXElement(path) {
        jsxCount++;
        const name = getComponentName(path);

        if (name === 'Button') buttonCount++;
        if (name === 'Input') inputCount++;

        // Show first 10
        if (jsxCount <= 10) {
          console.log(`  JSX Element #${jsxCount}: <${name}>`);
        }
      },
    });

    console.log(`\nFound ${jsxCount} JSX elements total`);
    console.log(`  - Button components: ${buttonCount}`);
    console.log(`  - Input components: ${inputCount}`);
  } catch (error) {
    console.error('❌ Parse error:', error.message);
  }
});
