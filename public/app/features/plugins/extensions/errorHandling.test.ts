import { AppConfigureExtension, AppPluginExtensionLink } from '@grafana/data';

import { createErrorHandling } from './errorHandling';

describe('extension error handling', () => {
  const pluginId = 'grafana-basic-app';
  const logger = jest.fn();
  const errorHandler = createErrorHandling<AppPluginExtensionLink>({
    pluginId: pluginId,
    title: 'Go to page one',
    logger: logger,
  });

  const context = {};
  const extension: AppPluginExtensionLink = {
    title: 'Go to page one',
    description: 'Will navigate the user to page one',
    path: `/a/${pluginId}/one`,
  };

  beforeEach(() => logger.mockClear());

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
    expect(logger).toBeCalledTimes(0);
  });

  it('should return undefined if configure throws error', () => {
    const configureWithErrorHandling = errorHandler(() => {
      throw new Error();
    });

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
    expect(logger).toBeCalledTimes(1);
  });

  it('should return undefined if configure is promise/async-based', () => {
    const promisebased = (async () => {}) as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(promisebased);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
    expect(logger).toBeCalledTimes(1);
  });

  it('should return undefined if configure is not a function', () => {
    const objectbased = {} as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(objectbased);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
    expect(logger).toBeCalledTimes(1);
  });

  it('should return undefined if configure returns other than an object', () => {
    const returnString = (() => '') as AppConfigureExtension<AppPluginExtensionLink>;
    const configureWithErrorHandling = errorHandler(returnString);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
    expect(logger).toBeCalledTimes(1);
  });

  it('should return undefined if configure returns undefined', () => {
    const returnUndefined = () => undefined;
    const configureWithErrorHandling = errorHandler(returnUndefined);

    const configured = configureWithErrorHandling(extension, context);

    expect(configured).toBeUndefined();
    expect(logger).toBeCalledTimes(0);
  });
});
