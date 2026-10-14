import { config } from '@grafana/runtime';

import { isNotificationHistoryEnabled, shouldUseAlertingListViewV2 } from './featureToggles';
import { mockLocalStorage } from './mocks';
import { setPreviewToggle } from './previewToggles';

const localStorageMock = mockLocalStorage();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('featureToggles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    config.featureToggles = {};
  });

  describe('shouldUseAlertingListViewV2', () => {
    it.each`
      listViewV2 | previewToggle | storedPreference | expected
      ${true}    | ${false}      | ${undefined}     | ${true}
      ${true}    | ${false}      | ${false}         | ${false}
      ${true}    | ${true}       | ${undefined}     | ${true}
      ${true}    | ${true}       | ${true}          | ${true}
      ${true}    | ${true}       | ${false}         | ${false}
      ${false}   | ${false}      | ${undefined}     | ${false}
      ${false}   | ${false}      | ${true}          | ${false}
      ${false}   | ${true}       | ${true}          | ${false}
    `(
      'returns $expected when alertingListViewV2 is $listViewV2, alertingListViewV2PreviewToggle is $previewToggle and the stored preference is $storedPreference',
      ({ listViewV2, previewToggle, storedPreference, expected }) => {
        config.featureToggles.alertingListViewV2 = listViewV2;
        config.featureToggles.alertingListViewV2PreviewToggle = previewToggle;
        setPreviewToggle('alertingListViewV2', storedPreference);

        expect(shouldUseAlertingListViewV2()).toBe(expected);
      }
    );
  });

  describe('isNotificationHistoryEnabled', () => {
    afterEach(() => {
      config.unifiedAlerting.notificationHistoryEnabled = undefined;
    });

    it('should be enabled when the backend does not send the setting', () => {
      config.unifiedAlerting.notificationHistoryEnabled = undefined;

      expect(isNotificationHistoryEnabled()).toBe(true);
    });

    it.each([true, false])('should follow the backend setting when it is %s', (enabled) => {
      config.unifiedAlerting.notificationHistoryEnabled = enabled;

      expect(isNotificationHistoryEnabled()).toBe(enabled);
    });
  });
});
