// We set this specifically for 2 reasons.
// 1. It makes sense for both CI tests and local tests to behave the same so issues are found earlier
// 2. Any wrong timezone handling could be hidden if we use UTC/GMT local time (which would happen in CI).
process.env.TZ = 'Pacific/Easter';

module.exports = {
  verbose: false,
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': require.resolve('ts-jest'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(ol)/)', // <- exclude the open layers library
  ],
  moduleDirectories: ['node_modules', 'public'],
  roots: ['<rootDir>/public/app', '<rootDir>/public/test', '<rootDir>/packages'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['jest-canvas-mock', './public/test/jest-shim.ts', './public/test/jest-setup.ts'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['./public/test/setupTests.ts'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  globals: {
    'ts-jest': { isolatedModules: true },
    __webpack_public_path__: '', // empty string
  },
  moduleNameMapper: {
    '\\.svg': '<rootDir>/public/test/mocks/svg.ts',
    '\\.css': '<rootDir>/public/test/mocks/style.ts',
    'monaco-editor/esm/vs/editor/editor.api': '<rootDir>/public/test/mocks/monaco.ts',

    // lingui-macro (for i18n) makes use of babel-macro, which we do not enable in tests, so we
    // provide our own mock component
    '@lingui/macro': '<rootDir>/public/test/mocks/linguiMacro.tsx',

    // i18n messages.js files are auto-generated, and may not exist when the tests are ran.
    // Because we mock out <Trans /> anyway, we can mock the messages also
    'locales/\\w+/messages$': '<rootDir>/public/test/mocks/i18nMessages.ts',
  },
  watchPathIgnorePatterns: ['<rootDir>/node_modules/'],
};
