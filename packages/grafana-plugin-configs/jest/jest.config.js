process.env.TZ = 'Pacific/Easter'; // UTC-06:00 or UTC-05:00 depending on daylight savings

import path from 'path';

import { grafanaESModules, nodeModulesToTransform } from './utils.js';

export default {
  moduleNameMapper: {
    '\\.(css|scss|sass)$': 'identity-obj-proxy',
    'react-inlinesvg': path.resolve(import.meta.dirname, 'mocks', 'react-inlinesvg.tsx'),
    '\\.(svg|png|jpg)': path.resolve(import.meta.dirname, 'mocks', 'images.ts'),
    '^monaco-editor$': 'monaco-editor/esm/vs/editor/editor.api.js',
    '@kusto/monaco-kusto': '@kusto/monaco-kusto/release/esm/monaco.contribution.js',
  },
  modulePaths: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs'],
  setupFiles: ['jest-canvas-mock'],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}', '<rootDir>/**/*.{spec,test,jest}.{js,jsx,ts,tsx}'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },
  // Jest will throw `Cannot use import statement outside module` if it tries to load an
  // ES module without it being transformed first. ./config/README.md#esm-errors-with-jest
  transformIgnorePatterns: [nodeModulesToTransform(grafanaESModules)],
  watchPathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/dist'],
};
