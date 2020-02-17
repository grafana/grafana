module.exports = {
  verbose: false,
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleDirectories: ['node_modules', 'public'],
  roots: ['<rootDir>/public/app', '<rootDir>/public/test', '<rootDir>/packages', '<rootDir>/scripts'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFiles: ['jest-canvas-mock', './public/test/jest-shim.ts', './public/test/jest-setup.ts'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  globals: { 'ts-jest': { isolatedModules: true } },
};
