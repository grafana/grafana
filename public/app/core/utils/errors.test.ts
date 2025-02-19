import { FetchError } from '@grafana/runtime';
import { getMessageFromError } from 'app/core/utils/errors';
import { LoadError } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

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
