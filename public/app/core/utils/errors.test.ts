import { type FetchError } from '@grafana/runtime';
import {
  armExpectedNavigationAbort,
  clearExpectedNavigationAbort,
  getMessageFromError,
  isIgnorableFetchAbort,
  markExpectedNavigationAbort,
} from 'app/core/utils/errors';
import { type LoadError } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

describe('errors functions', () => {
  let message: string | null;

  describe('when getMessageFromError gets an error string', () => {
    beforeEach(() => {
      message = getMessageFromError('error string');
    });

    it('should return the string', () => {
      expect(message).toBe('error string');
    });
  });

  describe('when getMessageFromError gets an error object with message field', () => {
    beforeEach(() => {
      message = getMessageFromError(new Error('error string'));
    });

    it('should return the message text', () => {
      expect(message).toBe('error string');
    });
  });

  describe('when getMessageFromError gets an error object with data.message field', () => {
    beforeEach(() => {
      message = getMessageFromError({ data: { message: 'error string' }, status: 500 } as FetchError);
    });

    it('should return the message text', () => {
      expect(message).toBe('error string');
    });
  });

  describe('when getMessageFromError gets an error object with statusText field', () => {
    beforeEach(() => {
      message = getMessageFromError({ data: 'foo', statusText: 'error string', status: 500 } as FetchError);
    });

    it('should return the statusText text', () => {
      expect(message).toBe('error string');
    });
  });

  describe('when getMessageFromError gets an error object', () => {
    beforeEach(() => {
      message = getMessageFromError({ customError: 'error string' });
    });

    it('should return the stringified error', () => {
      expect(message).toBe('{"customError":"error string"}');
    });
  });

  describe('when getMessageFromError gets an LoadError object', () => {
    beforeEach(() => {
      const error: LoadError = {
        message: 'error string',
        status: 500,
      };
      message = getMessageFromError(error);
    });

    it('should return the stringified error', () => {
      expect(message).toBe('error string');
    });
  });
});

describe('isIgnorableFetchAbort', () => {
  afterEach(() => {
    clearExpectedNavigationAbort();
  });

  it('returns false for Firefox and Safari fetch failures unless a navigation abort is expected', () => {
    expect(isIgnorableFetchAbort(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(false);
    expect(isIgnorableFetchAbort(new TypeError('Load failed'))).toBe(false);
    expect(
      isIgnorableFetchAbort({ message: 'NetworkError when attempting to fetch resource.', status: undefined })
    ).toBe(false);
  });

  it('returns true for Firefox and Safari fetch failures while a navigation abort is expected', () => {
    markExpectedNavigationAbort();
    expect(isIgnorableFetchAbort(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isIgnorableFetchAbort(new TypeError('Load failed'))).toBe(true);
    expect(
      isIgnorableFetchAbort({ message: 'NetworkError when attempting to fetch resource.', status: undefined })
    ).toBe(true);
  });

  it('returns true for AbortError and cancelled fetch errors', () => {
    const abort = new Error('The operation was aborted.');
    abort.name = 'AbortError';
    expect(isIgnorableFetchAbort(abort)).toBe(true);
    expect(isIgnorableFetchAbort({ cancelled: true, status: -1, statusText: 'Request was aborted' })).toBe(true);
  });

  it('returns false for real request failures even during navigation', () => {
    markExpectedNavigationAbort();
    expect(isIgnorableFetchAbort(new TypeError('Failed to fetch'))).toBe(false);
    expect(isIgnorableFetchAbort({ data: { message: 'Dashboard not found' }, status: 404 } as FetchError)).toBe(false);
    expect(isIgnorableFetchAbort(new Error('boom'))).toBe(false);
  });

  describe('armExpectedNavigationAbort', () => {
    const firefoxAbort = new TypeError('NetworkError when attempting to fetch resource.');

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('clears the flag if the page is still here after navigation is cancelled', () => {
      armExpectedNavigationAbort();
      expect(isIgnorableFetchAbort(firefoxAbort)).toBe(true);

      jest.advanceTimersByTime(1000);

      expect(isIgnorableFetchAbort(firefoxAbort)).toBe(false);
    });

    it('keeps the flag if pagehide fires because the document is unloading', () => {
      armExpectedNavigationAbort();
      window.dispatchEvent(new Event('pagehide'));

      jest.advanceTimersByTime(1000);

      expect(isIgnorableFetchAbort(firefoxAbort)).toBe(true);
    });
  });
});
