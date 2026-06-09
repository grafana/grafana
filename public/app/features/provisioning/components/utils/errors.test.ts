import { getProvisionedRequestError } from './errors';

function makeFetchError(status: number, data?: Record<string, unknown>) {
  return { status, data: data ?? {} };
}

describe('getProvisionedRequestError', () => {
  describe('404 - file not found', () => {
    it('returns the resource-agnostic branch message', () => {
      const result = getProvisionedRequestError(makeFetchError(404, { message: 'file not found' }), 'fallback');
      expect(result).toBe('You have selected a branch that does not contain this resource. Select another branch.');
    });
  });

  describe('404 - unknown message', () => {
    it('extracts data.message for unrecognized 404', () => {
      const result = getProvisionedRequestError(makeFetchError(404, { message: 'something unexpected' }), 'fallback');
      expect(result).toBe('something unexpected');
    });

    it('returns fallback when 404 has no message', () => {
      const result = getProvisionedRequestError(makeFetchError(404), 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('non-404 fetch errors', () => {
    it('extracts data.message from the error', () => {
      const result = getProvisionedRequestError(makeFetchError(500, { message: 'Internal server error' }), 'fallback');
      expect(result).toBe('Internal server error');
    });

    it('does not return the branch-not-found message', () => {
      const result = getProvisionedRequestError(makeFetchError(403, { message: 'Forbidden' }), 'fallback');
      expect(result).not.toContain('does not contain this resource');
      expect(result).toBe('Forbidden');
    });
  });

  describe('non-fetch errors', () => {
    it('extracts message from a plain Error object', () => {
      const result = getProvisionedRequestError(new Error('something broke'), 'fallback');
      expect(result).toBe('something broke');
    });

    it('uses String coercion for non-empty string errors', () => {
      const result = getProvisionedRequestError('custom error text', 'fallback');
      expect(result).toBe('custom error text');
    });
  });

  describe('nullish errors', () => {
    it('returns fallback for undefined error', () => {
      const result = getProvisionedRequestError(undefined, 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns fallback for null error', () => {
      const result = getProvisionedRequestError(null, 'fallback');
      expect(result).toBe('fallback');
    });
  });
});
