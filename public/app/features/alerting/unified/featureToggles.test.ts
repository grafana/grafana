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
    describe('when alertingListViewV2 toggle is disabled', () => {
      beforeEach(() => {
        config.featureToggles.alertingListViewV2 = false;
      });

      it('should return false when no localStorage preference is set', () => {
        expect(shouldUseAlertingListViewV2()).toBe(false);
      });

      it('should return true when localStorage preference is true', () => {
        setPreviewToggle('alertingListViewV2', true);

        expect(shouldUseAlertingListViewV2()).toBe(true);
      });

      it('should return false when localStorage preference is false', () => {
        setPreviewToggle('alertingListViewV2', false);

        expect(shouldUseAlertingListViewV2()).toBe(false);
      });
    });

    describe('when alertingListViewV2 toggle is enabled', () => {
      beforeEach(() => {
        config.featureToggles.alertingListViewV2 = true;
      });

      it('should return true when no localStorage preference is set', () => {
        expect(shouldUseAlertingListViewV2()).toBe(true);
      });

      it('should return true when localStorage preference is true', () => {
        setPreviewToggle('alertingListViewV2', true);

        expect(shouldUseAlertingListViewV2()).toBe(true);
      });

      it('should return false when localStorage preference is false', () => {
        setPreviewToggle('alertingListViewV2', false);

        expect(shouldUseAlertingListViewV2()).toBe(false);
      });
    });
  });
});
