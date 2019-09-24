import fs from 'fs';
import * as jestCLI from 'jest-cli';
import { TestResultsInfo } from '../types';
import { GRAFANA_E2E_INSTALL_SCRIPT_PATH } from "@grafana/e2e";

export async function runEndToEndTests(outputDirectory: string, results: TestResultsInfo): Promise<void> {
  const setupPath = GRAFANA_E2E_INSTALL_SCRIPT_PATH;
  let ext = '.js';
  if (!fs.existsSync(setupPath + ext)) {
    ext = '.ts'; // When running yarn link
  }

  const jestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules'], // add the plugin somehow?
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles: [],
    setupFilesAfterEnv: [
      'expect-puppeteer', // Setup Puppeteer
      `${setupPath}${ext}`, // Loads Chromimum
    ],
    globals: { 'ts-jest': { isolatedModules: true } },
    testMatch: [
      // Apparently all tests needs to be under rootDir
      '<rootDir>/e2e/.tmp/**/*.test.ts',
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
