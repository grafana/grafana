import { AppEvents } from '@grafana/data';

import { getRestoreNotificationData } from './notifications';

describe('notifications', () => {
  describe('getRestoreNotificationData', () => {
    // note: pluralisation is handled as part of the i18n framework
    // in tests, only the fallback singular message is used
    it('returns null when both arrays are empty', () => {
      const result = getRestoreNotificationData([], [], '');
      expect(result).toBeNull();
    });

    it('returns action notification when all restored successfully with single dashboard', () => {
      const result = getRestoreNotificationData(['uid1'], [], '');
      expect(result).toEqual({
        kind: 'action',
        data: {
          title: 'Dashboard restored',
          buttonLabel: 'View dashboard',
          targetUrl: '/d/uid1',
        },
      });
    });

    it('returns action notification when all restored successfully with multiple dashboards', () => {
      const result = getRestoreNotificationData(['uid1', 'uid2', 'uid3'], [], 'folder-uid');
      expect(result).toEqual({
        kind: 'action',
        data: {
          title: 'Dashboards restored',
          buttonLabel: 'View folder',
          targetUrl: '/dashboards/f/folder-uid',
        },
      });
    });

    it('returns action notification that targets root when restoring to general', () => {
      const result = getRestoreNotificationData(['uid1', 'uid2'], [], 'general');
      expect(result).toEqual({
        kind: 'action',
        data: {
          title: 'Dashboards restored',
          buttonLabel: 'View folder',
          targetUrl: '/dashboards',
        },
      });
    });

    it('returns warning for partial success without error details', () => {
      const result = getRestoreNotificationData(['uid1'], [{ uid: 'failed1', error: '' }], '');
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertWarning.name,
          message: '1 dashboard restored successfully. 1 dashboard failed.',
        },
      });
    });

    it('returns warning for partial success with error details', () => {
      const result = getRestoreNotificationData(['uid1', 'uid2'], [{ uid: 'failed1', error: 'Permission denied' }], '');
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertWarning.name,
          message: '2 dashboard restored successfully. 1 dashboard failed. Permission denied',
        },
      });
    });

    it('returns warning for partial success with multiple failures', () => {
      const result = getRestoreNotificationData(
        ['uid1'],
        [
          { uid: 'failed1', error: 'First error' },
          { uid: 'failed2', error: 'Second error' },
        ],
        ''
      );
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertWarning.name,
          message: '1 dashboard restored successfully. 2 dashboard failed. First error',
        },
      });
    });

    it('returns error when all failed with single dashboard', () => {
      const result = getRestoreNotificationData([], [{ uid: 'failed1', error: '' }], '');
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertError.name,
          message: 'Failed to restore 1 dashboard.',
        },
      });
    });

    it('returns error when all failed with error details', () => {
      const result = getRestoreNotificationData([], [{ uid: 'failed1', error: 'Database connection error' }], '');
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertError.name,
          message: 'Failed to restore 1 dashboard. Database connection error',
        },
      });
    });

    it('returns error when all failed with multiple dashboards', () => {
      const result = getRestoreNotificationData(
        [],
        [
          { uid: 'failed1', error: '' },
          { uid: 'failed2', error: '' },
        ],
        ''
      );
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertError.name,
          message: 'Failed to restore 2 dashboard.',
        },
      });
    });

    it('returns error when all failed with multiple dashboards and error details', () => {
      const result = getRestoreNotificationData(
        [],
        [
          { uid: 'failed1', error: 'Network timeout' },
          { uid: 'failed2', error: 'Another error' },
          { uid: 'failed3', error: 'Yet another error' },
        ],
        ''
      );
      expect(result).toEqual({
        kind: 'event',
        data: {
          alertType: AppEvents.alertError.name,
          message: 'Failed to restore 3 dashboard. Network timeout',
        },
      });
    });

    it('only includes first error message when multiple failures exist', () => {
      const result = getRestoreNotificationData(
        [],
        [
          { uid: 'failed1', error: 'First error' },
          { uid: 'failed2', error: 'Second error should not appear' },
        ],
        ''
      );
      expect(result?.kind).toBe('event');
      if (result?.kind === 'event') {
        expect(result.data.message).toContain('First error');
        expect(result.data.message).not.toContain('Second error should not appear');
      }
    });
  });
});
