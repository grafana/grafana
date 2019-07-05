import { getPluginJson, validatePluginJson } from './pluginValidation';

describe('pluginValdation', () => {
  describe('plugin.json', () => {
    test('missing plugin.json file', () => {
      expect(() => getPluginJson(`${__dirname}/mocks/missing-plugin-json`)).toThrow('plugin.json file is missing!');
    });
  });

  describe('validatePluginJson', () => {
    test('missing plugin.json file', () => {
      expect(() => validatePluginJson({})).toThrow('Plugin id is missing in plugin.json');
    });
  });
});
