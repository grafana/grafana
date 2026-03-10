import i18next from 'i18next';
import { getI18n, initReactI18next, setDefaults, setI18n } from 'react-i18next';

import { DEFAULT_LANGUAGE } from './constants';
import {
  loadNamespacedResources,
  initDefaultI18nInstance,
  initDefaultReactI18nInstance,
  initPluginTranslations,
} from './i18n';
import { ResourceLoader } from './types';

vi.mock('react-i18next', async (originalOptions) => {
  return {
    ...(await originalOptions()),
    getI18n: vi.fn(),
    setDefaults: vi.fn(),
    setI18n: vi.fn(),
  };
});

const getI18nMock = vi.mocked(getI18n);
const setDefaultsMock = vi.mocked(setDefaults);
const setI18nMock = vi.mocked(setI18n);

describe('i18n', () => {
  let originalOptions = i18next.options;

  beforeEach(() => {
    vi.resetAllMocks();
    i18next.use(initReactI18next).init({
      resources: {},
      returnEmptyString: false,
      lng: 'en-US', // this should be the locale of the phrases in our source JSX
    });
    getI18nMock.mockReturnValue(i18next);
    setDefaultsMock.mockReturnValue();
    setI18nMock.mockReturnValue();
    vi.clearAllMocks();
  });

  afterEach(() => {
    i18next.options = originalOptions;
  });

  describe('loadNamespacedResources', () => {
    it('should load all resources for a plugin', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = vi.spyOn(i18next, 'addResourceBundle');

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
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const addResourceBundleSpy = vi.spyOn(i18next, 'addResourceBundle');

      await loadNamespacedResources('test', 'en-US', loaders);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(1);
      expect(addResourceBundleSpy).toHaveBeenCalledWith('en-US', 'test', { i18n: 'i18n' }, true, false);
    });

    it('should not load resources if no loaders are provided', async () => {
      const loaders: ResourceLoader[] = [];
      const addResourceBundleSpy = vi.spyOn(i18next, 'addResourceBundle');

      await loadNamespacedResources('test', 'en-US', loaders);

      expect(addResourceBundleSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('initDefaultI18nInstance', () => {
    it('should not initialize the i18n instance if the resources are already initialized', async () => {
      const useSpy = vi.spyOn(i18next, 'use');
      const initSpy = vi.spyOn(i18next, 'init');

      await initDefaultI18nInstance();

      expect(useSpy).not.toHaveBeenCalled(); // not called because the resources are already initialized in public/test/setupTests.ts
      expect(initSpy).not.toHaveBeenCalled(); // not called because the resources are already initialized in public/test/setupTests.ts
    });

    it('should initialize the i18n instance if the resources are not initialized', async () => {
      i18next.options = { ...originalOptions, resources: undefined };
      const useSpy = vi.spyOn(i18next, 'use');
      const initSpy = vi.spyOn(i18next, 'init');

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
      i18next.options = { ...originalOptions, react: {} };

      initDefaultReactI18nInstance();

      expect(setDefaultsMock).not.toHaveBeenCalled();
      expect(setI18nMock).not.toHaveBeenCalled();
    });

    it('should initialize the react i18n instance if the react options are not initialized', async () => {
      i18next.options = { ...originalOptions, react: undefined };

      initDefaultReactI18nInstance();

      expect(setDefaultsMock).toHaveBeenCalledTimes(1);
      expect(setDefaultsMock).toHaveBeenCalledWith({});
      expect(setI18nMock).toHaveBeenCalledTimes(1);
      expect(setI18nMock).toHaveBeenCalledWith(i18next);
    });
  });

  describe('initPluginTranslations', () => {
    it('should not initialize the i18n instance and the react i18n instance if they are already initialized', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = vi.spyOn(i18next, 'addResourceBundle');
      const useSpy = vi.spyOn(i18next, 'use').mockReturnValue(i18next);
      const initSpy = vi.spyOn(i18next, 'init').mockImplementation(vi.fn());
      i18next.options = { ...originalOptions, react: {}, resources: {} };

      const { language } = await initPluginTranslations('test', loaders);

      expect(language).toBe('en-US');
      expect(useSpy).not.toHaveBeenCalled();
      expect(initSpy).not.toHaveBeenCalled();
      expect(setDefaultsMock).not.toHaveBeenCalled();
      expect(setI18nMock).not.toHaveBeenCalled();
      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test', { hello: 'Hi' }, true, false);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(2, 'en-US', 'test', { i18n: 'i18n' }, true, false);
    });

    it('should initialize the i18n instance and the react i18n instance if they are not initialized', async () => {
      const loaders: ResourceLoader[] = [
        () => Promise.resolve({ hello: 'Hi' }),
        () => Promise.resolve({ i18n: 'i18n' }),
      ];
      const addResourceBundleSpy = vi.spyOn(i18next, 'addResourceBundle');
      const useSpy = vi.spyOn(i18next, 'use').mockReturnValue(i18next);
      const initSpy = vi.spyOn(i18next, 'init').mockImplementation(vi.fn());
      i18next.options = { ...originalOptions, react: undefined, resources: undefined };

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
      expect(setDefaultsMock).toHaveBeenCalledTimes(1);
      expect(setDefaultsMock).toHaveBeenCalledWith({});
      expect(setI18nMock).toHaveBeenCalledTimes(1);
      expect(setI18nMock).toHaveBeenCalledWith(i18next);
      expect(addResourceBundleSpy).toHaveBeenCalledTimes(2);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test', { hello: 'Hi' }, true, false);
      expect(addResourceBundleSpy).toHaveBeenNthCalledWith(2, 'en-US', 'test', { i18n: 'i18n' }, true, false);
    });
  });
});
