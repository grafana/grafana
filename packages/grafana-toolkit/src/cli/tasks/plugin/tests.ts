import * as jestCLI from 'jest-cli';
import { useSpinner } from '../../utils/useSpinner';
import { loadJestPluginConfig } from '../../../config/jest.plugin.config';

export interface PluginTestOptions {
  updateSnapshot: boolean;
  coverage: boolean;
  watch: boolean;
  testPathPattern?: string;
  testNamePattern?: string;
}

export const testPlugin = useSpinner<PluginTestOptions>(
  'Running tests',
  async ({ updateSnapshot, coverage, watch, testPathPattern, testNamePattern }) => {
    const testConfig = loadJestPluginConfig();

    const cliConfig = {
      config: JSON.stringify(testConfig),
      updateSnapshot,
      coverage,
      watch,
      testPathPattern: testPathPattern ? [testPathPattern] : [],
      testNamePattern: testNamePattern ? [testNamePattern] : [],
      passWithNoTests: true,
    };

    // @ts-ignore
    const runJest = () => jestCLI.runCLI(cliConfig, [process.cwd()]);

    if (watch) {
      runJest();
    } else {
      // @ts-ignore
      const results = await runJest();

      if (results.results.numFailedTests > 0 || results.results.numFailedTestSuites > 0) {
        throw new Error('Tests failed');
      }
    }
  }
);
