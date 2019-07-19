import * as jestCLI from 'jest-cli';
import { SingleTestResult } from '../types';
import { PluginMeta } from '@grafana/ui';

export interface EndToEndTestOptions {
  plugin: PluginMeta;
  outputFolderPath: string;
}

export async function runEndToEndTests(options: EndToEndTestOptions): Promise<SingleTestResult[]> {
  const jestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules'], // TODO dist?
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles: [],
    setupFilesAfterEnv: [
      'expect-puppeteer', // Setup Puppeteer
      '<rootDir>/node_modules/@grafana/toolkit/src/plugin-ci/e2e/setup.ts', // Loads Chromimum
    ],
    globals: { 'ts-jest': { isolatedModules: true } },
    testMatch: [
      '<rootDir>/node_modules/@grafana/toolkit/src/plugin-ci/e2e/common_tests.ts',
      '<rootDir>/e2e/test/**/*.test.ts',
    ],
    providesModuleNodeModules: ['.*'],
    testPathIgnorePatterns: [
      // "/node_modules/"
    ],
    transformIgnorePatterns: [
      // '[/\\\\\\\\]node_modules[/\\\\\\\\].+\\\\.(js|jsx|ts|tsx)$',
      // '^.+\\\\.module\\\\.(css|sass|scss)$',
    ],
    reporters: ['default', 'jest-junit'],
  };

  const cliConfig = {
    config: JSON.stringify(jestConfig),
    passWithNoTests: true,
  };

  // @ts-ignore
  const runJest = () => jestCLI.runCLI(cliConfig, [process.cwd()]);

  const results = await runJest();

  console.log('GOT:', results);
  return [];
}
