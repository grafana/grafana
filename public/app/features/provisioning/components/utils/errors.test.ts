import { getProvisionedRequestError } from './errors';

function makeFetchError(status: number, data?: Record<string, unknown>) {
  return { status, data: data ?? {} };
}

describe('getProvisionedRequestError', () => {
  describe('404 fetch errors', () => {
    it('returns dashboard branch-not-found message', () => {
      const result = getProvisionedRequestError(makeFetchError(404), 'dashboard', 'fallback');
      expect(result).toBe('You have selected a branch that does not contain this dashboard. Select another branch.');
    });

    it('returns folder branch-not-found message', () => {
      const result = getProvisionedRequestError(makeFetchError(404), 'folder', 'fallback');
      expect(result).toBe('You have selected a branch that does not contain this folder. Select another branch.');
    });

    it('ignores the data.message field on a 404', () => {
      const result = getProvisionedRequestError(makeFetchError(404, { message: 'Not Found' }), 'dashboard', 'fallback');
      expect(result).toContain('does not contain this dashboard');
    });
  });

  describe('non-404 fetch errors', () => {
    it('extracts data.message from the error', () => {
      const result = getProvisionedRequestError(
        makeFetchError(500, { message: 'Internal server error' }),
        'dashboard',
        'fallback'
      );
      expect(result).toBe('Internal server error');
    });

    it('does not return the branch-not-found message', () => {
      const result = getProvisionedRequestError(makeFetchError(403, { message: 'Forbidden' }), 'dashboard', 'fallback');
      expect(result).not.toContain('does not contain this dashboard');
      expect(result).toBe('Forbidden');
    });
  });

  describe('non-fetch errors', () => {
    it('extracts message from a plain Error object', () => {
      const result = getProvisionedRequestError(new Error('something broke'), 'folder', 'fallback');
      expect(result).toBe('something broke');
    });

    it('returns fallback for a string error that is empty', () => {
      const result = getProvisionedRequestError('', 'dashboard', 'fallback');
      expect(result).toBe('fallback');
    });

    it('uses String coercion for non-empty string errors', () => {
      const result = getProvisionedRequestError('custom error text', 'dashboard', 'fallback');
      expect(result).toBe('custom error text');
    });
  });
});
