module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  preset: 'ts-jest',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
        allowJs: true,
      },
    ],
  },
  moduleNameMapper: {
    '^d3-interpolate$': '<rootDir>/__mocks__/d3-interpolate.ts',
  },
};
