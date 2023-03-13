import { AppPluginExtensionLink } from '@grafana/data';

import { handleErrorsInConfigure, handleErrorsInHandler } from './errorHandling';
import type { CommandHandlerFunc, ConfigureFunc } from './types';

describe('error handling for extensions', () => {
  describe('error handling for configure', () => {
    const pluginId = 'grafana-basic-app';
    const errorHandler = handleErrorsInConfigure<AppPluginExtensionLink>({
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
      const promisebased = (async () => {}) as ConfigureFunc<AppPluginExtensionLink>;
      const configureWithErrorHandling = errorHandler(promisebased);

      const configured = configureWithErrorHandling(extension, context);

      expect(configured).toBeUndefined();
    });

    it('should return undefined if configure is not a function', () => {
      const objectbased = {} as ConfigureFunc<AppPluginExtensionLink>;
      const configureWithErrorHandling = errorHandler(objectbased);

      const configured = configureWithErrorHandling(extension, context);

      expect(configured).toBeUndefined();
    });

    it('should return undefined if configure returns other than an object', () => {
      const returnString = (() => '') as ConfigureFunc<AppPluginExtensionLink>;
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

  describe('error handling for command handler', () => {
    const pluginId = 'grafana-basic-app';
    const errorHandler = handleErrorsInHandler({
      pluginId: pluginId,
      title: 'open modal',
      logger: jest.fn(),
    });

    it('should be called successfully when handler is a normal synchronous function', () => {
      const handler = jest.fn();
      const handlerWithErrorHandling = errorHandler(handler);

      handlerWithErrorHandling();

      expect(handler).toBeCalled();
    });

    it('should not error out even if the handler throws an error', () => {
      const handlerWithErrorHandling = errorHandler(() => {
        throw new Error();
      });

      expect(handlerWithErrorHandling).not.toThrowError();
    });

    it('should be called successfully when handler is an async function / promise', () => {
      const promisebased = (async () => {}) as CommandHandlerFunc;
      const configureWithErrorHandling = errorHandler(promisebased);

      expect(configureWithErrorHandling).not.toThrowError();
    });

    it('should be called successfully when handler is not a function', () => {
      const objectbased = {} as CommandHandlerFunc;
      const configureWithErrorHandling = errorHandler(objectbased);

      expect(configureWithErrorHandling).not.toThrowError();
    });
  });
});
