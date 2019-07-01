import path = require('path');
import fs = require('fs');

const whitelistedJestConfigOverrides = ['snapshotSerializers'];

export const jestConfig = () => {
  const jestConfigOverrides = require(path.resolve(process.cwd(), 'package.json')).jest;
  const blacklistedOverrides = jestConfigOverrides
    ? Object.keys(jestConfigOverrides).filter(override => whitelistedJestConfigOverrides.indexOf(override) === -1)
    : [];
  if (blacklistedOverrides.length > 0) {
    console.error("\ngrafana-toolkit doesn't support following Jest options: ", blacklistedOverrides);
    console.log('Supported Jest options are: ', JSON.stringify(whitelistedJestConfigOverrides));
    throw new Error('Provided Jest config is not supported');
  }

  const shimsFilePath = path.resolve(process.cwd(), 'config/jest-shim.ts');
  const setupFilePath = path.resolve(process.cwd(), 'config/jest-setup.ts');

  const setupFile = fs.existsSync(setupFilePath) ? setupFilePath : undefined;
  const shimsFile = fs.existsSync(shimsFilePath) ? shimsFilePath : undefined;
  const setupFiles = [setupFile, shimsFile].filter(f => f);
  const defaultJestConfig = {
    preset: 'ts-jest',
    verbose: false,
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleDirectories: ['node_modules', 'src'],
    rootDir: process.cwd(),
    roots: ['<rootDir>/src'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles,
    globals: { 'ts-jest': { isolatedModules: true } },
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/node_modules/**', '!**/vendor/**'],
    updateSnapshot: false,
    passWithNoTests: true,
  };

  return {
    ...defaultJestConfig,
    ...jestConfigOverrides,
  };
};
