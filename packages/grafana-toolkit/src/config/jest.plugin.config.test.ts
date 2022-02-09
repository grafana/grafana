import { jestConfig, allowedJestConfigOverrides } from './jest.plugin.config';

describe('Jest config', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw if not supported overrides provided', () => {
    // Do not show console error,log when running test
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    const getConfig = () => jestConfig(`${__dirname}/mocks/jestSetup/unsupportedOverrides`);

    expect(getConfig).toThrow('Provided Jest config is not supported');
  });

  it(`should allow ${allowedJestConfigOverrides} settings overrides`, () => {
    const config = jestConfig(`${__dirname}/mocks/jestSetup/overrides`);
    const configKeys = Object.keys(config);

    for (const whitelistedOption of allowedJestConfigOverrides) {
      expect(configKeys).toContain(whitelistedOption);
    }
  });

  describe('stylesheets support', () => {
    it('should provide module name mapper for stylesheets by default', () => {
      const config = jestConfig(`${__dirname}/mocks/jestSetup/noOverrides`);
      expect(config.moduleNameMapper).toBeDefined();
      expect(Object.keys(config.moduleNameMapper)).toContain('\\.(css|sass|scss)$');
    });

    it('should preserve mapping for stylesheets when moduleNameMapper overrides provided', () => {
      const config = jestConfig(`${__dirname}/mocks/jestSetup/overrides`);
      expect(config.moduleNameMapper).toBeDefined();
      expect(Object.keys(config.moduleNameMapper)).toContain('\\.(css|sass|scss)$');
      expect(Object.keys(config.moduleNameMapper)).toContain('someOverride');
    });
  });
});
