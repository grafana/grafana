import path = require('path');
import * as jestCLI from 'jest-cli';
import { useSpinner } from '../../utils/useSpinner';
import { jestConfig } from '../../../config/jest.plugin.config';

export const testPlugin = useSpinner<void>('Running tests', async () => {
  const testConfig = jestConfig();

  // @ts-ignore
  testConfig.setupFiles = [
    // @ts-ignore
    path.resolve(__dirname, '../../../config/jest-setup.js'),
    // @ts-ignore
    path.resolve(__dirname, '../../../config/jest-shim.js'),
  ];

  const results = await jestCLI.runCLI(testConfig as any, [process.cwd()]);
  if (results.results.numFailedTests > 0 || results.results.numFailedTestSuites > 0) {
    throw new Error('Tests failed');
  }
});
