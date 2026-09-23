import { config } from '@grafana/runtime';

import { shouldUseAlertingListViewV2 } from './featureToggles';
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
    describe('when alertingListViewV2PreviewToggle is enabled', () => {
      beforeEach(() => {
        config.featureToggles.alertingListViewV2PreviewToggle = true;
      });

      it.each`
        listViewV2 | storedPreference | expected
        ${false}   | ${undefined}     | ${false}
        ${false}   | ${true}          | ${true}
        ${false}   | ${false}         | ${false}
        ${true}    | ${undefined}     | ${true}
        ${true}    | ${true}          | ${true}
        ${true}    | ${false}         | ${false}
      `(
        'returns $expected when alertingListViewV2 is $listViewV2 and the stored preference is $storedPreference',
        ({ listViewV2, storedPreference, expected }) => {
          config.featureToggles.alertingListViewV2 = listViewV2;
          setPreviewToggle('alertingListViewV2', storedPreference);

          expect(shouldUseAlertingListViewV2()).toBe(expected);
        }
      );
    });

    describe('when alertingListViewV2PreviewToggle is disabled', () => {
      it.each`
        listViewV2 | storedPreference | expected
        ${false}   | ${undefined}     | ${false}
        ${false}   | ${true}          | ${false}
        ${true}    | ${undefined}     | ${true}
        ${true}    | ${false}         | ${true}
      `(
        'returns $expected when alertingListViewV2 is $listViewV2, ignoring the stored preference $storedPreference',
        ({ listViewV2, storedPreference, expected }) => {
          config.featureToggles.alertingListViewV2 = listViewV2;
          setPreviewToggle('alertingListViewV2', storedPreference);

          expect(shouldUseAlertingListViewV2()).toBe(expected);
        }
      );
    });
  });
});
