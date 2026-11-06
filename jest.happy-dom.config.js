const base = require('./jest.config');

module.exports = {
  ...base,
  testEnvironment: '<rootDir>/public/test/happy-dom-environment.js',
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': [
      require.resolve('@sucrase/jest-plugin'),
      {
        jsxRuntime: 'automatic',
        production: true,
        disableESTransforms: false,
        preserveDynamicImport: false,
      },
    ],
  },
};
