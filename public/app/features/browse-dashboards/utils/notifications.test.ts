import { AppEvents } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getRestoreNotificationData, RESTORE_FETCH_NOT_FOUND } from './notifications';

describe('notifications', () => {
  describe('getRestoreNotificationData', () => {
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

    describe('permission-aware failure guidance', () => {
      it('returns folder guidance when a dashboard fails to create with 403', () => {
        const result = getRestoreNotificationData(
          [],
          [{ uid: 'failed1', error: 'Forbidden', status: 403, step: 'create' }],
          ''
        );
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertError.name,
            message: expect.stringContaining('Choose a folder where you have edit permissions'),
          },
        });
      });

      it('returns admin guidance when a deleted dashboard is not visible in the recently-deleted listing', () => {
        const result = getRestoreNotificationData(
          [],
          [{ uid: 'failed1', error: RESTORE_FETCH_NOT_FOUND, step: 'fetch' }],
          ''
        );
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertError.name,
            message: expect.stringContaining('Ask an administrator to restore them'),
          },
        });
      });

      it('returns admin guidance when the recently-deleted read fails with 403', () => {
        const result = getRestoreNotificationData(
          [],
          [{ uid: 'failed1', error: 'Forbidden', status: 403, step: 'fetch' }],
          ''
        );
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertError.name,
            message: expect.stringContaining('Ask an administrator to restore them'),
          },
        });
      });

      it('prefers create guidance when both create and fetch permission failures exist', () => {
        const result = getRestoreNotificationData(
          [],
          [
            { uid: 'failed1', error: 'Forbidden', status: 403, step: 'fetch' },
            { uid: 'failed2', error: 'Forbidden', status: 403, step: 'create' },
          ],
          ''
        );
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertError.name,
            message: expect.stringContaining('Choose a folder where you have edit permissions'),
          },
        });
      });

      it('falls back to the first raw error for failures without permission info', () => {
        const result = getRestoreNotificationData([], [{ uid: 'failed1', error: 'boom' }], '');
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertError.name,
            message: 'Failed to restore 1 dashboard. boom',
          },
        });
      });

      it('appends folder guidance to the partial-success warning', () => {
        const successful = Array.from({ length: 9 }, (_, i) => `uid${i + 1}`);
        const result = getRestoreNotificationData(
          successful,
          [{ uid: 'failed1', error: 'Forbidden', status: 403, step: 'create' }],
          ''
        );
        expect(result).toEqual({
          kind: 'event',
          data: {
            alertType: AppEvents.alertWarning.name,
            message:
              "9 dashboard restored successfully. 1 dashboard failed. You don't have permission to add dashboards to the selected folder. Choose a folder where you have edit permissions, or ask an administrator to restore the dashboards.",
          },
        });
      });
    });

    describe('with appSubUrl', () => {
      const originalAppSubUrl = config.appSubUrl;

      beforeEach(() => {
        config.appSubUrl = '/grafana';
      });

      afterEach(() => {
        config.appSubUrl = originalAppSubUrl;
      });

      it('prefixes single dashboard URL with appSubUrl', () => {
        const result = getRestoreNotificationData(['uid1'], [], '');
        expect(result).toEqual({
          kind: 'action',
          data: {
            title: 'Dashboard restored',
            buttonLabel: 'View dashboard',
            targetUrl: '/grafana/d/uid1',
          },
        });
      });

      it('prefixes folder URL with appSubUrl', () => {
        const result = getRestoreNotificationData(['uid1', 'uid2'], [], 'folder-uid');
        expect(result).toEqual({
          kind: 'action',
          data: {
            title: 'Dashboards restored',
            buttonLabel: 'View folder',
            targetUrl: '/grafana/dashboards/f/folder-uid',
          },
        });
      });

      it('prefixes root dashboards URL with appSubUrl', () => {
        const result = getRestoreNotificationData(['uid1', 'uid2'], [], 'general');
        expect(result).toEqual({
          kind: 'action',
          data: {
            title: 'Dashboards restored',
            buttonLabel: 'View folder',
            targetUrl: '/grafana/dashboards',
          },
        });
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
