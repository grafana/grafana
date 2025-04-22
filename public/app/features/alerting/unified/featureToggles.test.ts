import { setLocalStorageFeatureToggle } from './featureToggles';

const featureTogglesKey = 'grafana.featureToggles';
const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  clear: () => storage.clear(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('setLocalStorageFeatureToggle', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should set feature toggle to true', () => {
    setLocalStorageFeatureToggle('alertingListViewV2', true);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true');
  });

  it('should set feature toggle to false', () => {
    setLocalStorageFeatureToggle('alertingListViewV2', false);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=false');
  });

  it('should remove feature toggle when set to undefined', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=true,alertingCentralAlertHistory=true'
    );

    setLocalStorageFeatureToggle('alertingPrometheusRulesPrimary', undefined);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true,alertingCentralAlertHistory=true');
  });

  it('should not set undefined when no feature toggles are set', () => {
    storage.set(featureTogglesKey, '');

    setLocalStorageFeatureToggle('alertingPrometheusRulesPrimary', undefined);
    expect(storage.get(featureTogglesKey)).toBe('');
  });

  it('should update only one feature toggle when multiple feature toggles are set', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=true,alertingCentralAlertHistory=true'
    );

    setLocalStorageFeatureToggle('alertingPrometheusRulesPrimary', false);
    expect(storage.get(featureTogglesKey)).toBe(
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=false,alertingCentralAlertHistory=true'
    );
  });

  it('should not rewrite other feature toggles when updating one', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=1,alertingCentralAlertHistory=false'
    );

    setLocalStorageFeatureToggle('alertingListViewV2', false);
    expect(storage.get(featureTogglesKey)).toBe(
      'alertingListViewV2=false,alertingPrometheusRulesPrimary=1,alertingCentralAlertHistory=false'
    );
  });

  it('should add a new toggle when others exist', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=true');
    setLocalStorageFeatureToggle('alertingCentralAlertHistory', true);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true,alertingCentralAlertHistory=true');
  });

  it('should remove the only existing toggle', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=true');
    setLocalStorageFeatureToggle('alertingListViewV2', undefined);
    expect(storage.get(featureTogglesKey)).toBe('');
  });

  it('should not change localStorage when attempting to remove a non-existent toggle', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=true');
    setLocalStorageFeatureToggle('alertingCentralAlertHistory', undefined);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true');
  });
});
