import { act, renderHook } from '@testing-library/react';

import { useFeatureToggle } from './featureToggles';

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

describe('useFeatureToggle', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should return undefined when feature toggle is not set', () => {
    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [featureToggle] = result.current;
    expect(featureToggle).toBeUndefined();
  });

  it('should return true when feature toggle is set to true', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=true');

    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(true);
  });

  it('should return true when feature toggle is set to 1', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=1');

    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(true);
  });

  it('should return false when feature toggle is set to false', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=false');

    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(false);
  });

  it('should return false when feature toggle is non-boolean value', () => {
    storage.set(featureTogglesKey, 'alertingListViewV2=non-boolean');

    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(false);
  });

  it('should set feature toggle to true', async () => {
    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [, setFeatureToggle] = result.current;

    act(() => {
      setFeatureToggle(true);
    });

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(true);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true');
  });

  it('should set feature toggle to false', () => {
    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [, setFeatureToggle] = result.current;

    act(() => {
      setFeatureToggle(false);
    });

    const [featureToggle] = result.current;

    expect(featureToggle).toBe(false);
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=false');
  });

  it('should remove feature toggle when set to undefined', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=true,alertingCentralAlertHistory=true'
    );

    const { result } = renderHook(() => useFeatureToggle('alertingPrometheusRulesPrimary'));

    const [, setFeatureToggle] = result.current;

    act(() => {
      setFeatureToggle(undefined);
    });

    const [featureToggle] = result.current;
    expect(featureToggle).toBeUndefined();
    expect(storage.get(featureTogglesKey)).toBe('alertingListViewV2=true,alertingCentralAlertHistory=true');
  });

  it('should update only one feature toggle when multiple feature toggles are set', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=true,alertingCentralAlertHistory=true'
    );

    const { result } = renderHook(() => useFeatureToggle('alertingPrometheusRulesPrimary'));

    const [firstToggleValue, setFeatureToggle] = result.current;
    expect(firstToggleValue).toBe(true);

    act(() => {
      setFeatureToggle(false);
    });

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(false);
    expect(storage.get(featureTogglesKey)).toBe(
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=false,alertingCentralAlertHistory=true'
    );
  });

  it('should not rewrite other feature toggles when updating one', () => {
    storage.set(
      featureTogglesKey,
      'alertingListViewV2=true,alertingPrometheusRulesPrimary=1,alertingCentralAlertHistory=false'
    );

    const { result } = renderHook(() => useFeatureToggle('alertingListViewV2'));

    const [, setFeatureToggle] = result.current;

    act(() => {
      setFeatureToggle(false);
    });

    const [featureToggle] = result.current;
    expect(featureToggle).toBe(false);
    expect(storage.get(featureTogglesKey)).toBe(
      'alertingListViewV2=false,alertingPrometheusRulesPrimary=1,alertingCentralAlertHistory=false'
    );
  });
});
