import path = require('path');
import * as jestCLI from 'jest-cli';
import { useSpinner } from '../../utils/useSpinner';
import { jestConfig } from '../../../config/jest.plugin.config';

export interface PluginTestOptions {
  updateSnapshot: boolean;
  coverage: boolean;
}

export const testPlugin = useSpinner<PluginTestOptions>('Running tests', async ({ updateSnapshot, coverage }) => {
  const testConfig = jestConfig();

  testConfig.updateSnapshot = updateSnapshot;
  testConfig.coverage = coverage;

  const results = await jestCLI.runCLI(testConfig as any, [process.cwd()]);

  if (results.results.numFailedTests > 0 || results.results.numFailedTestSuites > 0) {
    throw new Error('Tests failed');
  }
});
