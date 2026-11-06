const base = require('./jest.config');

module.exports = {
  ...base,
  displayName: 'harness',
  roots: ['<rootDir>/scripts/test-harness'],
  testPathIgnorePatterns: base.testPathIgnorePatterns.filter((pattern) => pattern !== '<rootDir>/scripts/test-harness/'),
};
