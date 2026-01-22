#!/usr/bin/env node

/**
 * Master script to run all phases
 *
 * Usage:
 *   node run-all.mjs              # Run phases 1-3 (no code changes)
 *   node run-all.mjs --transform  # Run all 4 phases in dry-run mode
 *   node run-all.mjs --apply      # Run all 4 phases and apply changes
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INCLUDE_TRANSFORM = process.argv.includes('--transform');
const APPLY_CHANGES = process.argv.includes('--apply');

const phases = [
  {
    name: 'Phase 1: Discovery',
    script: '1-discover.mjs',
    required: true,
  },
  {
    name: 'Phase 2: Analysis',
    script: '2-analyze.mjs',
    required: true,
  },
  {
    name: 'Phase 3: Generate Selectors',
    script: '3-generate-selectors.mjs',
    required: true,
  },
  {
    name: 'Phase 4: Transform Code',
    script: '4-transform-code.mjs',
    required: false,
    args: APPLY_CHANGES ? ['--apply'] : [],
  },
];

/**
 * Run a script
 */
function runScript(phase) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Running: ${phase.name}`);
    console.log('='.repeat(70));

    const scriptPath = path.join(__dirname, phase.script);
    const args = phase.args || [];

    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${phase.name} completed successfully`);
        resolve();
      } else {
        console.error(`\n❌ ${phase.name} failed with code ${code}`);
        reject(new Error(`${phase.name} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ Failed to start ${phase.name}:`, error);
      reject(error);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Add Test IDs - Master Script\n');

  if (APPLY_CHANGES) {
    console.log('⚠️  APPLY MODE - Phase 4 will modify source files!');
  } else if (INCLUDE_TRANSFORM) {
    console.log('🔶 TRANSFORM DRY RUN - Phase 4 will show what would change');
  } else {
    console.log('📊 ANALYSIS MODE - Will generate selectors but not modify code');
  }

  console.log('');

  const phasesToRun = phases.filter((phase) => {
    if (phase.name.includes('Phase 4')) {
      return INCLUDE_TRANSFORM || APPLY_CHANGES;
    }
    return true;
  });

  console.log('Phases to run:');
  phasesToRun.forEach((phase) => {
    console.log(`  - ${phase.name}`);
  });

  try {
    for (const phase of phasesToRun) {
      await runScript(phase);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL PHASES COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));

    if (!INCLUDE_TRANSFORM && !APPLY_CHANGES) {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Review output/3-selector-code.ts');
      console.log('2. Manually merge into packages/grafana-e2e-selectors/src/selectors/components.ts');
      console.log('3. Run: yarn workspace @grafana/e2e-selectors build');
      console.log('4. Run: node run-all.mjs --transform (to see what would change)');
      console.log('5. Run: node run-all.mjs --apply (to actually modify files)');
    } else if (INCLUDE_TRANSFORM && !APPLY_CHANGES) {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Review output/4-transform-report.json');
      console.log('2. If satisfied, run: node run-all.mjs --apply');
    } else {
      console.log('\n💡 NEXT STEPS:');
      console.log('1. Review changes: git diff');
      console.log('2. Run tests: yarn test');
      console.log('3. Commit: git commit -m "feat(testid): add selectors to components"');
    }

    console.log('');
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

main();
