import fs from 'fs';
import path = require('path');

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
    ? Object.keys(jestConfigOverrides).filter((override) => allowedJestConfigOverrides.indexOf(override) === -1)
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
    'react-inlinesvg': `${__dirname}/react-inlinesvg.tsx`,
    ...moduleNameMapper,
  };

  const setupFile = getSetupFile(setupFilePath);
  const shimsFile = getSetupFile(shimsFilePath);

  const setupFiles = [setupFile, shimsFile, `${__dirname}/matchMedia.js`, require.resolve('jest-canvas-mock')].filter(
    (f) => f
  );
  const defaultJestConfig = {
    verbose: false,
    moduleDirectories: ['node_modules', 'src'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles,
    globals: {
      'ts-jest': {
        isolatedModules: true,
        tsconfig: path.resolve(baseDir, 'tsconfig.json'),
      },
    },
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/node_modules/**', '!**/vendor/**'],
    reporters: [
      'default',
      [
        require.resolve('jest-junit'),
        {
          outputDirectory: 'coverage',
        },
      ],
    ],
    testEnvironment: 'jsdom',
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
      '<rootDir>/spec/**/*.{spec,test,jest}.{js,jsx,ts,tsx}',
    ],
    transform: {
      '^.+\\.jsx?$': require.resolve('babel-jest'),
      '^.+\\.tsx?$': require.resolve('ts-jest'),
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
    const toolkitDir = path.dirname(require.resolve(`@grafana/toolkit/package.json`));
    const src = path.join(toolkitDir, 'src/config/jest.plugin.config.local.js');
    fs.copyFileSync(src, cfgpath);
    console.log('Using standard jest plugin config', src);
  }
  return require(cfgpath);
};
