import * as jestCLI from 'jest-cli';
import { useSpinner } from '../../utils/useSpinner';
import { loadJestPluginConfig } from '../../../config/jest.plugin.config';

export interface PluginTestOptions {
  updateSnapshot: boolean;
  coverage: boolean;
  watch: boolean;
  testPathPattern?: string;
  testNamePattern?: string;
  maxWorkers?: string;
}

export const testPlugin = ({
  updateSnapshot,
  coverage,
  watch,
  testPathPattern,
  testNamePattern,
  maxWorkers,
}: PluginTestOptions) =>
  useSpinner('Running tests', async () => {
    const testConfig = loadJestPluginConfig();

    const cliConfig = {
      config: JSON.stringify(testConfig),
      updateSnapshot,
      coverage,
      watch,
      testPathPattern: testPathPattern ? [testPathPattern] : [],
      testNamePattern: testNamePattern ? [testNamePattern] : [],
      passWithNoTests: true,
      maxWorkers,
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
  });
