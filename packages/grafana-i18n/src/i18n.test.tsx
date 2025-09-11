import i18n from 'i18next';
import { initReactI18next, setDefaults, setI18n } from 'react-i18next';

import { DEFAULT_LANGUAGE } from './constants';
import {
  loadNamespacedResources,
  initDefaultI18nInstance,
  initDefaultReactI18nInstance,
  initPluginTranslations,
} from './i18n';
import { ResourceLoader } from './types';

jest.mock('react-i18next', () => ({
  getI18n: () => i18n,
  setDefaults: jest.fn(),
  setI18n: jest.fn(),
}));

describe('i18n', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('loadNamespacedResources', () => {
    it('should load all resources for a plugin', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = jest.spyOn(i18n, 'addResourceBundle');

      await loadNamespacedResources('test', 'en-US', loaders);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test', { hello: 'Hi' }, true, false);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(2, 'en-US', 'test', { i18n: 'i18n' }, true, false);
    });

    it('should load all resources  for a plugin even if a loader throws', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.reject({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      jest.spyOn(console, 'error').mockImplementation();
      const addResourceBundleSpy = jest.spyOn(i18n, 'addResourceBundle');

      await loadNamespacedResources('test', 'en-US', loaders);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(1);
      expect(addResourceBundleSpy).toHaveBeenCalledWith('en-US', 'test', { i18n: 'i18n' }, true, false);
    });

    it('should not load resources if no loaders are provided', async () => {
      const loaders: ResourceLoader[] = [];
      const addResourceBundleSpy = jest.spyOn(i18n, 'addResourceBundle');

      await loadNamespacedResources('test', 'en-US', loaders);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('initDefaultI18nInstance', () => {
    it('should not initialize the i18n instance if the resources are already initialized', async () => {
      const useSpy = jest.spyOn(i18n, 'use').mockImplementation();
      const initSpy = jest.spyOn(i18n, 'init').mockImplementation();

      await initDefaultI18nInstance();

      expect(useSpy).not.toHaveBeenCalled(); // not called because the resources are already initialized in public/test/setupTests.ts
      expect(initSpy).not.toHaveBeenCalled(); // not called because the resources are already initialized in public/test/setupTests.ts
    });

    it('should initialize the i18n instance if the resources are not initialized', async () => {
      jest.replaceProperty(i18n, 'options', { resources: undefined });
      const useSpy = jest.spyOn(i18n, 'use').mockImplementation(() => i18n);
      const initSpy = jest.spyOn(i18n, 'init').mockImplementation();

      await initDefaultI18nInstance();

      expect(useSpy).toHaveBeenCalledTimes(1);
      expect(useSpy).toHaveBeenCalledWith(initReactI18next);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({
        resources: {},
        returnEmptyString: false,
        lng: DEFAULT_LANGUAGE,
      });
    });
  });

  describe('initDefaultReactI18nInstance', () => {
    it('should not initialize the react i18n instance if the react options are already initialized', async () => {
      jest.replaceProperty(i18n, 'options', { react: {} });

      initDefaultReactI18nInstance();

      expect(setDefaults).not.toHaveBeenCalled();
      expect(setI18n).not.toHaveBeenCalled();
    });

    it('should initialize the react i18n instance if the react options are not initialized', async () => {
      jest.replaceProperty(i18n, 'options', { react: undefined });

      initDefaultReactI18nInstance();

      expect(setDefaults).toHaveBeenCalledTimes(1);
      expect(setDefaults).toHaveBeenCalledWith({});
      expect(setI18n).toHaveBeenCalledTimes(1);
      expect(setI18n).toHaveBeenCalledWith(i18n);
    });
  });

  describe('initPluginTranslations', () => {
    it('should not initialize the i18n instance and the react i18n instance if they are already initialized', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = jest.spyOn(i18n, 'addResourceBundle');
      const useSpy = jest.spyOn(i18n, 'use').mockImplementation();
      const initSpy = jest.spyOn(i18n, 'init').mockImplementation();
      jest.replaceProperty(i18n, 'options', { react: {}, resources: {} });

      const { language } = await initPluginTranslations('test', loaders);

      expect(language).toBe('en-US');
      expect(useSpy).not.toHaveBeenCalled();
      expect(initSpy).not.toHaveBeenCalled();
      expect(setDefaults).not.toHaveBeenCalled();
      expect(setI18n).not.toHaveBeenCalled();
      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test', { hello: 'Hi' }, true, false);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(2, 'en-US', 'test', { i18n: 'i18n' }, true, false);
    });

    it('should initialize the i18n instance and the react i18n instance if they are not initialized', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = jest.spyOn(i18n, 'addResourceBundle');
      const useSpy = jest.spyOn(i18n, 'use').mockImplementation(() => i18n);
      const initSpy = jest.spyOn(i18n, 'init').mockImplementation();
      jest.replaceProperty(i18n, 'options', { react: undefined, resources: undefined });

      const { language } = await initPluginTranslations('test', loaders);

      expect(language).toBe('en-US');
      expect(useSpy).toHaveBeenCalledTimes(1);
      expect(useSpy).toHaveBeenCalledWith(initReactI18next);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({
        resources: {},
        returnEmptyString: false,
        lng: DEFAULT_LANGUAGE,
      });
      expect(setDefaults).toHaveBeenCalledTimes(1);
      expect(setDefaults).toHaveBeenCalledWith({});
      expect(setI18n).toHaveBeenCalledTimes(1);
      expect(setI18n).toHaveBeenCalledWith(i18n);
      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test', { hello: 'Hi' }, true, false);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(2, 'en-US', 'test', { i18n: 'i18n' }, true, false);
    });
  });
});
