import { type FetchError } from '@grafana/runtime';
import { getMessageFromError, isIgnorableFetchAbort } from 'app/core/utils/errors';
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
  it('returns true for Firefox navigation abort', () => {
    expect(isIgnorableFetchAbort(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
  });

  it('returns true for Safari navigation abort', () => {
    expect(isIgnorableFetchAbort(new TypeError('Load failed'))).toBe(true);
  });

  it('returns true for AbortError and cancelled fetch errors', () => {
    const abort = new Error('The operation was aborted.');
    abort.name = 'AbortError';
    expect(isIgnorableFetchAbort(abort)).toBe(true);
    expect(isIgnorableFetchAbort({ cancelled: true, status: -1, statusText: 'Request was aborted' })).toBe(true);
  });

  it('returns true for dashboard loadError built from a Firefox abort', () => {
    expect(
      isIgnorableFetchAbort({ message: 'NetworkError when attempting to fetch resource.', status: undefined })
    ).toBe(true);
  });

  it('returns false for real request failures', () => {
    expect(isIgnorableFetchAbort(new TypeError('Failed to fetch'))).toBe(false);
    expect(isIgnorableFetchAbort({ data: { message: 'Dashboard not found' }, status: 404 } as FetchError)).toBe(false);
    expect(isIgnorableFetchAbort(new Error('boom'))).toBe(false);
  });
});
