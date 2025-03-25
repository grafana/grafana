import { getI18next } from 'app/core/internationalization';

import { SystemJS } from './loader/systemjs';
import { addLocalesToI18n } from './plugin_loader';

describe('plugin_loader', () => {
  describe('addLocalesToI18n', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should add locales to i18n that exist', async () => {
      const locales = {
        'en-US': '/public/plugins/test-panel/locales/en-US/test-panel.json',
        'pt-BR': '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
      };

      jest.spyOn(SystemJS, 'import').mockImplementation((path) => {
        if (path === locales['en-US']) {
          return Promise.resolve({ default: { testKey: 'testValue' } });
        }
        return Promise.resolve({ default: { testKey: 'valorDeTeste' } });
      });

      const addResourceBundleSpy = jest.spyOn(getI18next(), 'addResourceBundle');

      await addLocalesToI18n('pluginId', locales);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(
        1,
        'en-US',
        'pluginId',
        { testKey: 'testValue' },
        undefined,
        true
      );
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(
        2,
        'pt-BR',
        'pluginId',
        { testKey: 'valorDeTeste' },
        undefined,
        true
      );
    });

    it('should add locales to i18n even if some locales do not exist', async () => {
      const locales = {
        'en-US': '/public/plugins/test-panel/locales/en-US/test-panel.json',
        'pt-BR': '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
      };

      jest.spyOn(SystemJS, 'import').mockImplementation((path) => {
        if (path === locales['en-US']) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve({ default: { testKey: 'valorDeTeste' } });
      });
      const consoleErrorSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const addResourceBundleSpy = jest.spyOn(getI18next(), 'addResourceBundle');

      await addLocalesToI18n('pluginId', locales);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(1);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(
        1,
        'pt-BR',
        'pluginId',
        { testKey: 'valorDeTeste' },
        undefined,
        true
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Could not load locale for plugin',
        'pluginId',
        'en-US',
        new Error('File not found')
      );
    });
  });
});
