import { mockLocalStorage } from './mocks';
import { getPreviewToggle, setPreviewToggle } from './previewToggles';

const localStorageMock = mockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('previewToggles', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getPreviewToggle', () => {
    it('should return undefined by default for a toggle', () => {
      const result = getPreviewToggle('alertingListViewV2');
      expect(result).toBe(undefined);
    });

    it.each([true, false])('should return the stored value for a toggle: %s', (value) => {
      // Set the toggle value first
      setPreviewToggle('alertingListViewV2', value);

      // Then verify it returns the correct value
      const result = getPreviewToggle('alertingListViewV2');
      expect(result).toBe(value);
    });
  });

  describe('setPreviewToggle', () => {
    it('should set a toggle value', () => {
      setPreviewToggle('alertingListViewV2', true);

      const result = getPreviewToggle('alertingListViewV2');
      expect(result).toBe(true);
    });

    it('should override previous toggle value', () => {
      // Set initial value
      setPreviewToggle('alertingListViewV2', true);

      // Override with new value
      setPreviewToggle('alertingListViewV2', false);

      const result = getPreviewToggle('alertingListViewV2');
      expect(result).toBe(false);
    });
  });
});
