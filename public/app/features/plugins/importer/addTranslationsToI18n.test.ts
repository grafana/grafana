import { i18n } from 'i18next';

import * as i18nModule from '@grafana/i18n/internal';

import { server } from '../loader/pluginLoader.mock';
import { SystemJS } from '../loader/systemjs';
import { SystemJSWithLoaderHooks } from '../loader/types';

import { addTranslationsToI18n } from './addTranslationsToI18n';

describe('addTranslationsToI18n', () => {
  const systemJSPrototype: SystemJSWithLoaderHooks = SystemJS.constructor.prototype;
  const originalFetch = systemJSPrototype.fetch;
  const originalResolve = systemJSPrototype.resolve;
  let addResourceBundleSpy: jest.SpyInstance;

  beforeAll(() => {
    server.listen();
    systemJSPrototype.resolve = (moduleId: string) => moduleId;
    systemJSPrototype.shouldFetch = () => true;
    // because server.listen() patches fetch, we need to reassign this to the systemJSPrototype
    // this is identical to what happens in the original code: https://github.com/systemjs/systemjs/blob/main/src/features/fetch-load.js#L12
    systemJSPrototype.fetch = window.fetch;
  });

  beforeEach(() => {
    addResourceBundleSpy = jest
      .spyOn(i18nModule, 'addResourceBundle')
      .mockImplementation(() => ({}) as unknown as i18n);
  });

  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    SystemJS.constructor.prototype.resolve = originalResolve;
    SystemJS.constructor.prototype.fetch = originalFetch;
    server.close();
  });

  it('should add translations that match the resolved language first', async () => {
    const translations = {
      'en-US': '/public/plugins/test-panel/locales/en-US/test-panel.json',
      'pt-BR': '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
    };

    await addTranslationsToI18n({
      resolvedLanguage: 'pt-BR',
      fallbackLanguage: 'en-US',
      pluginId: 'test-panel',
      translations,
    });

    expect(addResourceBundleSpy).toHaveBeenCalledTimes(1);
    expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'pt-BR', 'test-panel', { testKey: 'valorDeTeste' });
  });

  it('should add translations that match the fallback language if the resolved language is not in the translations', async () => {
    const translations = {
      'en-US': '/public/plugins/test-panel/locales/en-US/test-panel.json',
      'pt-BR': '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
    };

    await addTranslationsToI18n({
      resolvedLanguage: 'sv-SE',
      fallbackLanguage: 'en-US',
      pluginId: 'test-panel',
      translations,
    });

    expect(addResourceBundleSpy).toHaveBeenCalledTimes(1);
    expect(addResourceBundleSpy).toHaveBeenNthCalledWith(1, 'en-US', 'test-panel', { testKey: 'testValue' });
  });

  it('should warn if no translations are found', async () => {
    const translations = {
      'en-US': '/public/plugins/test-panel/locales/en-US/test-panel.json',
      'pt-BR': '/public/plugins/test-panel/locales/pt-BR/test-panel.json',
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addTranslationsToI18n({
      resolvedLanguage: 'sv-SE',
      fallbackLanguage: 'sv-SE',
      pluginId: 'test-panel',
      translations,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Could not find any translation for plugin test-panel', {
      resolvedLanguage: 'sv-SE',
      fallbackLanguage: 'sv-SE',
    });
  });

  it('should warn if no exported default is found', async () => {
    const translations = {
      'en-US': '/public/plugins/test-panel/locales/en-US/no-default-export.json',
      'pt-BR': '/public/plugins/test-panel/locales/pt-BR/no-default-export.json',
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addTranslationsToI18n({
      resolvedLanguage: 'en-US',
      fallbackLanguage: 'en-US',
      pluginId: 'test-panel',
      translations,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Could not find default export for plugin test-panel', {
      resolvedLanguage: 'en-US',
      fallbackLanguage: 'en-US',
      path: '/public/plugins/test-panel/locales/en-US/no-default-export.json',
    });
  });

  it('should warn if translations cannot be loaded', async () => {
    const translations = {
      'en-US': '/public/plugins/test-panel/locales/en-US/unknown.json',
      'pt-BR': '/public/plugins/test-panel/locales/pt-BR/unknown.json',
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await addTranslationsToI18n({
      resolvedLanguage: 'en-US',
      fallbackLanguage: 'pt-BR',
      pluginId: 'test-panel',
      translations,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Could not load translation for plugin test-panel', {
      resolvedLanguage: 'en-US',
      fallbackLanguage: 'pt-BR',
      error: new TypeError('Failed to fetch'),
      path: '/public/plugins/test-panel/locales/en-US/unknown.json',
    });
  });
});
