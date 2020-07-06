module.exports = {
  verbose: true,
  globals: {
    'ts-jest': {
      tsConfigFile: 'tsconfig.json',
    },
  },
  transform: {
    '^.+\\.tsx?$': '<rootDir>/../../node_modules/ts-jest/preprocessor.js',
  },
  moduleDirectories: ['node_modules'],
  testRegex: '(\\.|/)(test)\\.ts$',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
};
