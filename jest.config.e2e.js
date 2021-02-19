require('module-alias/register');

module.exports = {
  verbose: false,
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleDirectories: ['node_modules', 'public'],
  roots: ['<rootDir>/public/e2e-test'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: [],
  globals: { 'ts-jest': { isolatedModules: true } },
  setupFilesAfterEnv: ['expect-puppeteer', '<rootDir>/packages/grafana-toolkit/src/e2e/install.ts'],
};