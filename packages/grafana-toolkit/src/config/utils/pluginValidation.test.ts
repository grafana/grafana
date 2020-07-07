import { getPluginJson, validatePluginJson } from './pluginValidation';

describe('pluginValidation', () => {
  describe('plugin.json', () => {
    test('missing plugin.json file', () => {
      expect(() => getPluginJson(`${__dirname}/mocks/missing-plugin.json`)).toThrowError();
    });
  });

  describe('validatePluginJson', () => {
    test('missing plugin.json file', () => {
      expect(() => validatePluginJson({})).toThrow('Plugin id is missing in plugin.json');
    });
  });
});
