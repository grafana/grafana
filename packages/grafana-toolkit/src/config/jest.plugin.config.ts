import path = require('path');
import fs from 'fs';

export const whitelistedJestConfigOverrides = ['snapshotSerializers', 'moduleNameMapper'];

interface EnabledJestConfigOverrides {
  snapshotSerializers: string[];
  moduleNameMapper: { [key: string]: string };
}

export const jestConfig = (baseDir: string = process.cwd()) => {
  const jestConfigOverrides = (require(path.resolve(baseDir, 'package.json')).jest || {}) as EnabledJestConfigOverrides;

  const blacklistedOverrides = jestConfigOverrides
    ? Object.keys(jestConfigOverrides).filter(override => whitelistedJestConfigOverrides.indexOf(override) === -1)
    : [];

  if (blacklistedOverrides.length > 0) {
    console.error("\ngrafana-toolkit doesn't support following Jest options: ", blacklistedOverrides);
    console.log('Supported Jest options are: ', JSON.stringify(whitelistedJestConfigOverrides));
    throw new Error('Provided Jest config is not supported');
  }

  const shimsFilePath = path.resolve(baseDir, 'config/jest-shim.ts');
  const setupFilePath = path.resolve(baseDir, 'config/jest-setup.ts');

  // Mock css imports for tests. Otherwise Jest will have troubles understanding SASS/CSS imports
  const { moduleNameMapper, ...otherOverrides } = jestConfigOverrides;
  const moduleNameMapperConfig = {
    '\\.(css|sass|scss)$': `${__dirname}/styles.mock.js`,
    ...moduleNameMapper,
  };

  const setupFile = fs.existsSync(setupFilePath) ? setupFilePath : undefined;
  const shimsFile = fs.existsSync(shimsFilePath) ? shimsFilePath : undefined;
  const setupFiles = [setupFile, shimsFile].filter(f => f);
  const defaultJestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules', 'src'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles,
    globals: { 'ts-jest': { isolatedModules: true } },
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/node_modules/**', '!**/vendor/**'],
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
    ],
    transformIgnorePatterns: [
      '[/\\\\\\\\]node_modules[/\\\\\\\\].+\\\\.(js|jsx|ts|tsx)$',
      '^.+\\\\.module\\\\.(css|sass|scss)$',
    ],
    moduleNameMapper: moduleNameMapperConfig,
  };

  return {
    ...defaultJestConfig,
    ...otherOverrides,
  };
};
