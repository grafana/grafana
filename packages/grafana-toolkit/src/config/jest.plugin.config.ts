export const jestConfig = () => {
  return {
    verbose: false,
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleDirectories: ['node_modules', 'src'],
    rootDir: process.cwd(),
    roots: ['<rootDir>/src'],
    testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles: [],
    snapshotSerializers: ['enzyme-to-json/serializer'],
    globals: { 'ts-jest': { isolatedModules: true } },
    coverageReporters: ['json-summary', 'text', 'lcov'],
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!**/node_modules/**', '!**/vendor/**'],
  };
};
