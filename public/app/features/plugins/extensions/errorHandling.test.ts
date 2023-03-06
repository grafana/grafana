import { AppConfigureExtension, AppPluginExtensionLink } from '@grafana/data';

import { createErrorHandling } from './errorHandling';

describe('extension error handling', () => {
  const pluginId = 'grafana-basic-app';
  const errorHandler = createErrorHandling<AppPluginExtensionLink>({
    pluginId: pluginId,
    title: 'Go to page one',
    logger: jest.fn(),
  });

  const context = {};
  const extension: AppPluginExtensionLink = {
    title: 'Go to page one',
    description: 'Will navigate the user to page one',
    path: `/a/${pluginId}/one`,
  };

  it('should return configured link if configure is successful', () => {
    const configureWithErrorHandling = errorHandler(() => {
      return {
        title: 'This is a new title',
      };
    });

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toEqual({
      title: 'This is a new title',
    });
  });

  it('should return undefined if configure throws error', () => {
    const configureWithErrorHandling = errorHandler(() => {
      throw new Error();
    });

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
  });

  it('should return undefined if configure is promise/async-based', () => {
    const promisebased = (async () => {}) as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(promisebased);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
  });

  it('should return undefined if configure is not a function', () => {
    const objectbased = {} as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(objectbased);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
  });

  it('should return undefined if configure returns other than an object', () => {
    const returnString = (() => '') as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(returnString);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
  });

  it('should return undefined if configure returns undefined', () => {
    const returnUndefined = () => undefined;
    const configureWithErrorHandling = errorHandler(returnUndefined);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
  });
});
