// We set this specifically for 2 reasons.
// 1. It makes sense for both CI tests and local tests to behave the same so issues are found earlier
// 2. Any wrong timezone handling could be hidden if we use UTC/GMT local time (which would happen in CI).
process.env.TZ = 'Pacific/Easter'; // UTC-06:00 or UTC-05:00 depending on daylight savings

const esModules = ['ol', 'd3', 'd3-color', 'd3-interpolate', 'delaunator', 'internmap', 'robust-predicates'].join('|');

module.exports = {
  verbose: false,
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [require.resolve('ts-jest'), { isolatedModules: true }],
  },
  transformIgnorePatterns: [
    `/node_modules/(?!${esModules})`, // exclude es modules to prevent TS complaining
  ],
  moduleDirectories: ['public'],
  roots: ['<rootDir>/public/app', '<rootDir>/public/test', '<rootDir>/packages'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['jest-canvas-mock', './public/test/jest-setup.ts'],
  testTimeout: 30000,
  resolver: `<rootDir>/public/test/jest-resolver.js`,
  setupFilesAfterEnv: ['./public/test/setupTests.ts'],
  globals: {
    __webpack_public_path__: '', // empty string
  },
  moduleNameMapper: {
    '\\.svg': '<rootDir>/public/test/mocks/svg.ts',
    '\\.css': '<rootDir>/public/test/mocks/style.ts',
    'monaco-editor/esm/vs/editor/editor.api': '<rootDir>/public/test/mocks/monaco.ts',
    // near-membrane-dom won't work in a nodejs environment.
    '@locker/near-membrane-dom': '<rootDir>/public/test/mocks/nearMembraneDom.ts',
    '^@grafana/schema/dist/esm/(.*)$': '<rootDir>/packages/grafana-schema/src/$1',
  },
  // Log the test results with dynamic Loki tags. Drone CI only
  reporters: ['default', ['<rootDir>/public/test/log-reporter.js', { enable: process.env.DRONE === 'true' }]],
};
