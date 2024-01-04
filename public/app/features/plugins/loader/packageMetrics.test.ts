import { logInfo } from '@grafana/runtime';

import { trackPackageUsage } from './packageMetrics';

jest.mock('@grafana/runtime', () => ({
  logInfo: jest.fn().mockImplementation(),
}));

// notice each test object has a different key to prevent hitting the cache
const logInfoMock = logInfo as jest.Mock;
const mockUsage = jest.fn();

describe('trackPackageUsage', () => {
  beforeEach(() => {
    logInfoMock.mockClear();
  });

  describe('With document.currentScript null', () => {
    const originalCurrentScript = document.currentScript;

    // set currentScript to null
    beforeAll(() => {
      Object.defineProperty(document, 'currentScript', {
        value: null,
        writable: true,
      });
    });

    // restore original currentScript
    afterAll(() => {
      Object.defineProperty(document, 'currentScript', {
        value: originalCurrentScript,
        writable: true,
      });
    });

    it('should not log API usage and for non-grafana packages', () => {
      const obj = {
        foo: 'bar',
      };
      const packageName = 'lodash';

      const result = trackPackageUsage(obj, packageName);

      mockUsage(result.foo);

      expect(logInfoMock).toHaveBeenCalledTimes(0);
    });

    it('should log API usage and return a proxy object for @grafana/data packages', () => {
      const obj = {
        foo: 'bar',
      };
      const packageName = '@grafana/data';

      const result = trackPackageUsage(obj, packageName);

      mockUsage(result.foo);

      expect(logInfoMock).toHaveBeenCalledTimes(1);
      expect(logInfoMock).toHaveBeenLastCalledWith(`Plugin using @grafana/data.foo`, {
        key: 'foo',
        parent: '@grafana/data',
        packageName: '@grafana/data',
      });
      expect(result).toEqual(obj);
    });

    it('should log API usage and return a proxy object for app/* packages', () => {
      const obj = {
        foo: 'bar',
      };
      const packageName = 'app/core/test';

      const result = trackPackageUsage(obj, packageName);

      mockUsage(result.foo);

      expect(logInfoMock).toHaveBeenCalledTimes(1);
      expect(logInfoMock).toHaveBeenLastCalledWith(`Plugin using app/core/test.foo`, {
        key: 'foo',
        parent: 'app/core/test',
        packageName: 'app/core/test',
      });
      expect(result).toEqual(obj);
    });

    it('should return a proxy object for nested properties', () => {
      const obj = {
        foo2: {
          bar: 'baz',
        },
      };
      const packageName = '@grafana/data';

      const result = trackPackageUsage(obj, packageName);
      mockUsage(result.foo2.bar);

      // 2 calls, one for each attribute
      expect(logInfoMock).toHaveBeenCalledTimes(2);

      expect(logInfoMock).toHaveBeenCalledWith(`Plugin using @grafana/data.foo2`, {
        key: 'foo2',
        parent: '@grafana/data',
        packageName: '@grafana/data',
      });
      expect(logInfoMock).toHaveBeenCalledWith(`Plugin using @grafana/data.foo2.bar`, {
        key: 'bar',
        parent: '@grafana/data.foo2',
        packageName: '@grafana/data',
      });

      expect(result.foo2).toEqual(obj.foo2);
    });

    it('should not log API usage for symbols or __useDefault key', () => {
      const obj = {
        [Symbol('key')]: 'value',
        __useDefault: 'default',
      };
      const packageName = '@grafana/data';

      const result = trackPackageUsage(obj, packageName);

      expect(logInfoMock).not.toHaveBeenCalled();
      expect(result).toEqual(obj);
    });

    it('should return the same proxy object for the same nested property', () => {
      const obj = {
        foo3: {
          bar: 'baz',
        },
      };
      const packageName = '@grafana/data';

      const result1 = trackPackageUsage(obj, packageName);
      const result2 = trackPackageUsage(obj, packageName);

      mockUsage(result1.foo3);

      expect(logInfoMock).toHaveBeenCalledTimes(1);
      expect(logInfoMock).toHaveBeenCalledWith(`Plugin using @grafana/data.foo3`, {
        key: 'foo3',
        parent: '@grafana/data',
        packageName: '@grafana/data',
      });
      mockUsage(result2.foo3.bar);
      expect(logInfoMock).toHaveBeenCalledWith(`Plugin using @grafana/data.foo3.bar`, {
        key: 'bar',
        parent: '@grafana/data.foo3',
        packageName: '@grafana/data',
      });

      expect(result1.foo3).toEqual(obj.foo3);
      expect(result2.foo3).toEqual(obj.foo3);
      expect(result1.foo3).toBe(result2.foo3);
    });

    it('should not report twice the same key usage', () => {
      const obj = {
        cacheMe: 'please',
        zap: {
          cacheMeInner: 'please',
        },
      };

      const result = trackPackageUsage(obj, '@grafana/data');

      mockUsage(result.cacheMe);
      expect(logInfoMock).toHaveBeenCalledTimes(1);
      mockUsage(result.cacheMe);
      expect(logInfoMock).toHaveBeenCalledTimes(1);

      mockUsage(result.zap);
      expect(logInfoMock).toHaveBeenCalledTimes(2);
      mockUsage(result.zap);
      expect(logInfoMock).toHaveBeenCalledTimes(2);

      mockUsage(result.zap.cacheMeInner);
      expect(logInfoMock).toHaveBeenCalledTimes(3);
      mockUsage(result.zap.cacheMeInner);
      expect(logInfoMock).toHaveBeenCalledTimes(3);

      expect(result).toEqual(obj);
    });
  });

  it('Should skip tracking if document.currentScript is not null', () => {
    // Save the original value of the attribute
    const originalCurrentScript = document.currentScript;

    // Define a new property on the document object with the mock currentScript
    Object.defineProperty(document, 'currentScript', {
      value: {
        src: 'mocked-script.js',
      },
      writable: true,
    });

    const obj = {
      lor: 'me',
    };

    const result = trackPackageUsage(obj, '@grafana/data');

    mockUsage(result.lor);
    expect(logInfoMock).not.toHaveBeenCalled();

    // Restore the original value of the currentScript attribute
    Object.defineProperty(document, 'currentScript', {
      value: originalCurrentScript,
      writable: true,
    });
  });
});
