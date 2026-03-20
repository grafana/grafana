import {
  classifyChannelError,
  CHANNEL_ERROR_DASHBOARD_DELETED,
  CHANNEL_ERROR_PERMISSION_DENIED,
  countPanels,
  isLockStale,
  isTabHidden,
  onVisibilityChange,
  STALE_LOCK_THRESHOLD_MS,
} from './collabEdgeCases';

describe('collabEdgeCases', () => {
  describe('classifyChannelError', () => {
    it('returns dashboard_deleted for 404 status', () => {
      expect(classifyChannelError({ status: 404 })).toBe(CHANNEL_ERROR_DASHBOARD_DELETED);
    });

    it('returns dashboard_deleted for "not found" message', () => {
      expect(classifyChannelError({ message: 'Dashboard Not Found' })).toBe(CHANNEL_ERROR_DASHBOARD_DELETED);
    });

    it('returns permission_denied for 403 status', () => {
      expect(classifyChannelError({ status: 403 })).toBe(CHANNEL_ERROR_PERMISSION_DENIED);
    });

    it('returns permission_denied for 401 status', () => {
      expect(classifyChannelError({ status: 401 })).toBe(CHANNEL_ERROR_PERMISSION_DENIED);
    });

    it('returns permission_denied for "forbidden" message', () => {
      expect(classifyChannelError({ message: 'Forbidden' })).toBe(CHANNEL_ERROR_PERMISSION_DENIED);
    });

    it('returns permission_denied for "unauthorized" message', () => {
      expect(classifyChannelError({ message: 'Unauthorized access' })).toBe(CHANNEL_ERROR_PERMISSION_DENIED);
    });

    it('returns null for unknown errors', () => {
      expect(classifyChannelError({ status: 500, message: 'Internal error' })).toBeNull();
    });

    it('returns null for null/undefined/non-object', () => {
      expect(classifyChannelError(null)).toBeNull();
      expect(classifyChannelError(undefined)).toBeNull();
      expect(classifyChannelError('string')).toBeNull();
    });
  });

  describe('isLockStale', () => {
    it('returns false when lock is fresh', () => {
      const now = Date.now();
      expect(isLockStale(now - 1000, undefined, now)).toBe(false);
    });

    it('returns true when lock exceeds threshold with no ops', () => {
      const now = Date.now();
      const acquiredAt = now - STALE_LOCK_THRESHOLD_MS - 1;
      expect(isLockStale(acquiredAt, undefined, now)).toBe(true);
    });

    it('uses lastOpByHolder as reference when available', () => {
      const now = Date.now();
      const acquiredAt = now - STALE_LOCK_THRESHOLD_MS - 1; // stale by acquiredAt
      const lastOp = now - 1000; // but recent op
      expect(isLockStale(acquiredAt, lastOp, now)).toBe(false);
    });

    it('returns true when lastOp itself is stale', () => {
      const now = Date.now();
      const acquiredAt = now - STALE_LOCK_THRESHOLD_MS - 60000;
      const lastOp = now - STALE_LOCK_THRESHOLD_MS - 1;
      expect(isLockStale(acquiredAt, lastOp, now)).toBe(true);
    });
  });

  describe('isTabHidden', () => {
    it('returns false when document is visible', () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      expect(isTabHidden()).toBe(false);
    });

    it('returns true when document is hidden', () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      expect(isTabHidden()).toBe(true);
    });
  });

  describe('onVisibilityChange', () => {
    it('calls callback on visibility change and returns unsubscribe', () => {
      const cb = jest.fn();
      const unsub = onVisibilityChange(cb);

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(cb).toHaveBeenCalledWith(true);

      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(cb).toHaveBeenCalledWith(false);

      unsub();
      cb.mockClear();
      document.dispatchEvent(new Event('visibilitychange'));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('countPanels', () => {
    it('returns count of children in scene body', () => {
      const scene = { state: { body: { state: { children: [1, 2, 3] } } } };
      expect(countPanels(scene)).toBe(3);
    });

    it('returns 0 for missing body', () => {
      expect(countPanels({ state: {} })).toBe(0);
    });

    it('returns 0 for missing children', () => {
      expect(countPanels({ state: { body: { state: {} } } })).toBe(0);
    });
  });
});
