module.exports = {
  verbose: true,
  roots: ['./spec'],
  moduleDirectories: ['node_modules', 'public', 'src'],
  modulePaths: ['./node_modules', './public', './src'],
  globalSetup: '<rootDir>/spec/globalSetup.js',
  globalTeardown: '<rootDir>/spec/globalTeardown.js',
  setupFiles: ['<rootDir>/spec/setup-jest.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    underscore$: 'lodash',
  },
  // transformIgnorePatterns: ['./public/.*', './node_modules/.*', './dist/.*'],
  testRegex: '(\\.|/)(test)\\.(jsx?|tsx?)$',
  transformIgnorePatterns: ['/node_modules/(?!vue-awesome)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
