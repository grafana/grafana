import path = require('path');
import fs = require('fs');

export const jestConfig = () => {
  const shimsFilePath = path.resolve(process.cwd(), 'config/jest-shim.ts');
  const setupFilePath = path.resolve(process.cwd(), 'config/jest-setup.ts');

  const setupFile = fs.existsSync(setupFilePath) ? setupFilePath : undefined;
  const shimsFile = fs.existsSync(shimsFilePath) ? shimsFilePath : undefined;
  const setupFiles = [setupFile, shimsFile].filter(f => f);

  return {
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
  };
};
