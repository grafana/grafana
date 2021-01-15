import path = require('path');
import fs from 'fs';

export const allowedJestConfigOverrides = [
  'snapshotSerializers',
  'moduleNameMapper',
  'globalSetup',
  'globalTeardown',
  'testEnvironment',
];

interface EnabledJestConfigOverrides {
  snapshotSerializers: string[];
  moduleNameMapper: { [key: string]: string };
}

const getSetupFile = (filePath: string) => {
  if (fs.existsSync(`${filePath}.js`)) {
    return `${filePath}.js`;
  }
  if (fs.existsSync(`${filePath}.ts`)) {
    return `${filePath}.ts`;
  }
  return undefined;
};

export const jestConfig = (baseDir: string = process.cwd()) => {
  const jestConfigOverrides = (require(path.resolve(baseDir, 'package.json')).jest || {}) as EnabledJestConfigOverrides;

  const deniedOverrides = jestConfigOverrides
    ? Object.keys(jestConfigOverrides).filter(override => allowedJestConfigOverrides.indexOf(override) === -1)
    : [];

  if (deniedOverrides.length > 0) {
    console.error("\ngrafana-toolkit doesn't support following Jest options: ", deniedOverrides);
    console.log('Supported Jest options are: ', JSON.stringify(allowedJestConfigOverrides));
    throw new Error('Provided Jest config is not supported');
  }

  const shimsFilePath = path.resolve(baseDir, 'config/jest-shim');
  const setupFilePath = path.resolve(baseDir, 'config/jest-setup');

  // Mock css imports for tests. Otherwise Jest will have troubles understanding SASS/CSS imports
  const { moduleNameMapper, ...otherOverrides } = jestConfigOverrides;
  const moduleNameMapperConfig = {
    '\\.(css|sass|scss)$': `${__dirname}/styles.mock.js`,
    ...moduleNameMapper,
  };

  const setupFile = getSetupFile(setupFilePath);
  const shimsFile = getSetupFile(shimsFilePath);

  const setupFiles = [setupFile, shimsFile, 'jest-canvas-mock'].filter(f => f);
  const defaultJestConfig = {
    preset: 'ts-jest',
    verbose: false,
    moduleDirectories: ['node_modules', 'src'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles,
    globals: {
      'ts-jest': {
        isolatedModules: true,
        tsConfig: path.resolve(baseDir, 'tsconfig.json'),
      },
    },
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/node_modules/**', '!**/vendor/**'],
    reporters: [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: 'coverage',
        },
      ],
    ],
    testEnvironment: 'jest-environment-jsdom-fifteen',
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
      '<rootDir>/spec/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
    ],
    transform: {
      '^.+\\.js$': 'babel-jest',
    },
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

/**
 * This will load the existing just setup, or use the default if it exists
 */
export const loadJestPluginConfig = (baseDir: string = process.cwd()) => {
  const cfgpath = path.resolve(baseDir, 'jest.config.js');
  if (!fs.existsSync(cfgpath)) {
    const src = path.resolve(baseDir, 'node_modules/@grafana/toolkit/src/config/jest.plugin.config.local.js');
    fs.copyFileSync(src, cfgpath);
    console.log('Using standard jest plugin config', src);
  }
  return require(cfgpath);
};
