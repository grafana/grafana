import * as jestCLI from 'jest-cli';
import { TestResultsInfo } from '../types';

export async function runEndToEndTests(outputDirectory: string, results: TestResultsInfo): Promise<void> {
  const jestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules'], // add the plugin somehow?
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles: [],
    setupFilesAfterEnv: [
      'expect-puppeteer', // Setup Puppeteer
      '<rootDir>/node_modules/@grafana/toolkit/src/e2e/install.ts', // Loads Chromimum
    ],
    globals: { 'ts-jest': { isolatedModules: true } },
    testMatch: [
      '<rootDir>/node_modules/@grafana/toolkit/src/plugin-ci/e2e/commonPluginTests.ts',
      '<rootDir>/e2e/test/**/*.test.ts',
    ],
    reporters: [
      'default',
      ['jest-junit', { outputDirectory }], // save junit.xml to folder
    ],
  };

  const cliConfig = {
    config: JSON.stringify(jestConfig),
    passWithNoTests: true,
  };

  // @ts-ignore
  const runJest = () => jestCLI.runCLI(cliConfig, [process.cwd()]);

  const jestOutput = await runJest();
  results.passed = jestOutput.results.numPassedTests;
  results.failed = jestOutput.results.numFailedTestSuites;
  return;
}
