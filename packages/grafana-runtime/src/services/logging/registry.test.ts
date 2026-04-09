import { type MonitoringLogger } from 'src/utils/logging';

import { LogLevel } from '@grafana/faro-web-sdk';

import { type LoggerDefaults } from './loggers';
import { addLogger, clearLoggerRegistry, getLogger, initializeLoggersRegistry, setLogger } from './registry';

const mockPushLog = jest.fn();
const mockPushError = jest.fn();
const mockPushMeasurement = jest.fn();

jest.mock('@grafana/faro-web-sdk', () => ({
  ...jest.requireActual('@grafana/faro-web-sdk'),
  faro: {
    api: {
      pushLog: (...args: unknown[]) => mockPushLog(...args),
      pushError: (...args: unknown[]) => mockPushError(...args),
      pushMeasurement: (...args: unknown[]) => mockPushMeasurement(...args),
    },
  },
}));

jest.mock('../../config', () => ({
  config: {
    grafanaJavascriptAgent: { enabled: true },
  },
}));

describe('logging registry', () => {
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    clearLoggerRegistry();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('initializeLoggersRegistry', () => {
    it('should populate the registry with loggers for all configured sources', () => {
      initializeLoggersRegistry();

      const pluginMetaLogger = getLogger('grafana/runtime.plugins.meta');
      const cachedPromiseLogger = getLogger('grafana/runtime.utils.getCachedPromise');

      expect(pluginMetaLogger).toBeDefined();
      expect(cachedPromiseLogger).toBeDefined();
    });
  });

  describe('addLogger', () => {
    it('should add a functional logger', () => {
      const defaults = { context: { env: 'dev' }, logToConsole: true };
      addLogger('grafana/runtime.plugins.meta', defaults);

      const logger = getLogger('grafana/runtime.plugins.meta');
      useLoggerFunctions(logger);

      expectLoggerFunctions({ debugSpy, errorSpy, logSpy, warnSpy }, defaults);
    });

    it('should warn when adding the same logger twice', () => {
      addLogger('grafana/runtime.plugins.meta');
      addLogger('grafana/runtime.plugins.meta', { context: { env: 'dev' }, logToConsole: true });

      expect(warnSpy).toHaveBeenCalledWith(
        'LoggerRegistry: a logger with the source:grafana/runtime.plugins.meta already exists, keeping existing entry.'
      );
    });

    it('should not overwrite existing logger when adding the same logger twice', () => {
      addLogger('grafana/runtime.plugins.meta');
      addLogger('grafana/runtime.plugins.meta', { context: { env: 'dev' }, logToConsole: true });

      warnSpy.mockClear(); // addLogger warns once when trying to add the same logger twice

      const logger = getLogger('grafana/runtime.plugins.meta');
      useLoggerFunctions(logger);

      expectLoggerFunctions({ debugSpy, errorSpy, logSpy, warnSpy }); // should not contain { env: 'dev' } or any console output
    });
  });

  describe('getLogger', () => {
    const originalEnvironment = process.env.NODE_ENV;

    describe('when called after initializeLoggersRegistry', () => {
      it('should return a functional logger', () => {
        initializeLoggersRegistry();

        const logger = getLogger('grafana/runtime.plugins.meta');

        useLoggerFunctions(logger);

        expectLoggerFunctions({ debugSpy, errorSpy, logSpy, warnSpy }, { logToConsole: true });
      });
    });

    describe.each([
      { env: 'test', throws: false },
      { env: 'development', throws: true },
      { env: 'production', throws: false },
    ])('when called for environment:$env before initializeLoggersRegistry', ({ env, throws }) => {
      beforeEach(() => {
        process.env.NODE_ENV = env;
      });

      afterEach(() => {
        process.env.NODE_ENV = originalEnvironment;
      });

      it('should warn and only throw in development environment', () => {
        if (throws) {
          expect(() => getLogger('grafana/runtime.plugins.meta')).toThrow(
            `LoggerRegistry: no logger 'grafana/runtime.plugins.meta' exists, are you calling getLogger before initializeLoggersRegistry function was called?`
          );
        }

        if (!throws) {
          getLogger('grafana/runtime.plugins.meta');
        }

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          `LoggerRegistry: no logger 'grafana/runtime.plugins.meta' exists, are you calling getLogger before initializeLoggersRegistry function was called?`
        );
      });

      it('should return a logger without default context and console output', () => {
        if (throws) {
          expect(true).toBe(true);
          return;
        }

        const logger = getLogger('grafana/runtime.plugins.meta');

        warnSpy.mockClear(); // getLogger warns when logger doesn't exists

        useLoggerFunctions(logger);

        expectLoggerFunctions({ debugSpy, errorSpy, logSpy, warnSpy }); // return a minimal logger
      });

      it('should not store logger in registry', () => {
        if (throws) {
          expect(true).toBe(true);
          return;
        }

        getLogger('grafana/runtime.plugins.meta');
        getLogger('grafana/runtime.plugins.meta');

        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(
          `LoggerRegistry: no logger 'grafana/runtime.plugins.meta' exists, are you calling getLogger before initializeLoggersRegistry function was called?`
        );
      });
    });
  });

  describe('setLogger', () => {
    it('should replace the registry entry with mocks', () => {
      // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
      setLogger('grafana/runtime.plugins.meta', {
        logDebug: jest.fn(),
        logError: jest.fn(),
        logInfo: jest.fn(),
        logMeasurement: jest.fn(),
        logWarning: jest.fn(),
      });

      const logger = getLogger('grafana/runtime.plugins.meta');
      logger.logInfo('mocked call');

      expect(logger.logInfo).toHaveBeenCalledWith('mocked call');
      expect(mockPushLog).not.toHaveBeenCalled();
    });

    it('should provide mock functions for all log methods', () => {
      // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
      setLogger('grafana/runtime.plugins.meta', {
        logDebug: jest.fn(),
        logError: jest.fn(),
        logInfo: jest.fn(),
        logMeasurement: jest.fn(),
        logWarning: jest.fn(),
      });

      const logger = getLogger('grafana/runtime.plugins.meta');

      expect(jest.isMockFunction(logger.logDebug)).toBe(true);
      expect(jest.isMockFunction(logger.logInfo)).toBe(true);
      expect(jest.isMockFunction(logger.logWarning)).toBe(true);
      expect(jest.isMockFunction(logger.logError)).toBe(true);
      expect(jest.isMockFunction(logger.logMeasurement)).toBe(true);
    });
  });
});

function useLoggerFunctions(logger: MonitoringLogger) {
  logger.logDebug('registry debug test', { pluginId: 'myorg-test-plugin' });
  logger.logError(new Error('registry error test'), { pluginId: 'myorg-test-plugin' });
  logger.logInfo('registry info test', { pluginId: 'myorg-test-plugin' });
  logger.logWarning('registry warning test', { pluginId: 'myorg-test-plugin' });
  logger.logMeasurement('some measurement', { render: 10 }, { pluginId: 'myorg-test-plugin' });
}

function expectLoggerFunctions(
  spies: {
    debugSpy: jest.SpyInstance;
    logSpy: jest.SpyInstance;
    errorSpy: jest.SpyInstance;
    warnSpy: jest.SpyInstance;
  },
  defaults?: LoggerDefaults
) {
  expect(mockPushLog).toHaveBeenNthCalledWith(1, ['registry debug test'], {
    level: LogLevel.DEBUG,
    context: { ...defaults?.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
  });
  expect(mockPushError).toHaveBeenNthCalledWith(1, new Error('registry error test'), {
    context: { ...defaults?.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
  });
  expect(mockPushLog).toHaveBeenNthCalledWith(2, ['registry info test'], {
    level: LogLevel.INFO,
    context: { ...defaults?.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
  });
  expect(mockPushLog).toHaveBeenNthCalledWith(3, ['registry warning test'], {
    level: LogLevel.WARN,
    context: { ...defaults?.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
  });
  expect(mockPushMeasurement).toHaveBeenNthCalledWith(
    1,
    { type: 'some measurement', values: { render: 10 } },
    {
      context: { ...defaults?.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
    }
  );

  if (!defaults?.logToConsole) {
    expect(spies.debugSpy).not.toHaveBeenCalled();
    expect(spies.errorSpy).not.toHaveBeenCalled();
    expect(spies.logSpy).not.toHaveBeenCalled();
    expect(spies.warnSpy).not.toHaveBeenCalled();
  }

  if (defaults?.logToConsole) {
    expect(spies.debugSpy).toHaveBeenCalledWith('registry debug test', {
      ...defaults.context,
      source: 'grafana/runtime.plugins.meta',
      pluginId: 'myorg-test-plugin',
    });
    expect(spies.errorSpy).toHaveBeenCalledWith(
      'registry error test',
      { ...defaults.context, source: 'grafana/runtime.plugins.meta', pluginId: 'myorg-test-plugin' },
      new Error('registry error test')
    );
    expect(spies.logSpy).toHaveBeenCalledWith('registry info test', {
      ...defaults.context,
      source: 'grafana/runtime.plugins.meta',
      pluginId: 'myorg-test-plugin',
    });
    expect(spies.warnSpy).toHaveBeenCalledWith('registry warning test', {
      ...defaults.context,
      source: 'grafana/runtime.plugins.meta',
      pluginId: 'myorg-test-plugin',
    });
  }
}
