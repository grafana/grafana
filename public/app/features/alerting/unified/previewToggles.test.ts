import { getPreviewToggle, setPreviewToggle } from './previewToggles';

// Mock localStorage
const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  clear: () => storage.clear(),
  removeItem: (key: string) => storage.delete(key),
  key: () => null,
  length: 0,
};

// Replace the global localStorage with our mock
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('previewToggles', () => {
  beforeEach(() => {
    // Clear the localStorage mock before each test
    storage.clear();
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
