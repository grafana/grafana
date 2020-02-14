import * as jestCLI from 'jest-cli';
import { TestResultsInfo } from '../types';
import fs from 'fs';

export async function runEndToEndTests(outputDirectory: string, results: TestResultsInfo): Promise<void> {
  const setupPath = 'node_modules/@grafana/toolkit/src/e2e/install';
  let ext = '.js';
  if (!fs.existsSync(setupPath + ext)) {
    ext = '.ts'; // When running yarn link
  }

  const jestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules'], // add the plugin somehow?
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFilesAfterEnv: [
      'expect-puppeteer', // Setup Puppeteer
      '<rootDir>/' + setupPath + ext, // Loads Chromimum
    ],
    globals: { 'ts-jest': { isolatedModules: true } },
    testMatch: [
      '<rootDir>/e2e-temp/**/*.test.ts', // Copied from node_modules
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
