const esModule = '@iconscout/react-unicons';

module.exports = {
  verbose: false,
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'ts-jest',
    [`(${esModule}).+\\.js$`]: 'babel-jest',
  },
  transformIgnorePatterns: [`/node_modules/(?!${esModule})`],
  moduleDirectories: ['node_modules', 'public'],
  roots: ['<rootDir>/public/app', '<rootDir>/public/test', '<rootDir>/packages', '<rootDir>/scripts'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['jest-canvas-mock', './public/test/jest-shim.ts', './public/test/jest-setup.ts'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  globals: { 'ts-jest': { isolatedModules: true } },
  moduleNameMapper: {
    '\\.svg': '<rootDir>/public/test/mocks/svg.ts',
  },
};
