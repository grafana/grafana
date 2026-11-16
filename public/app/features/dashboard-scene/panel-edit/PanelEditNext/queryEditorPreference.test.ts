import { store } from '@grafana/data';

import { QUERY_EDITOR_V2_PREFERENCE_KEY } from './constants';
import { getQueryEditorNextPreference, setQueryEditorNextPreference } from './queryEditorPreference';

describe('queryEditorPreference', () => {
  afterEach(() => {
    store.delete(QUERY_EDITOR_V2_PREFERENCE_KEY);
    jest.useRealTimers();
  });

  it('returns null when no preference is stored', () => {
    expect(getQueryEditorNextPreference()).toBeNull();
  });

  it.each([true, false])('returns the stored preference %s', (useNext) => {
    setQueryEditorNextPreference(useNext);

    expect(getQueryEditorNextPreference()).toBe(useNext);
  });

  it('keeps the preference indefinitely', () => {
    jest.useFakeTimers();
    setQueryEditorNextPreference(false);

    jest.advanceTimersByTime(365 * 24 * 60 * 60 * 1000);

    expect(getQueryEditorNextPreference()).toBe(false);
  });

  it('reads a preference saved in the earlier TTL format, however old', () => {
    store.setObject(QUERY_EDITOR_V2_PREFERENCE_KEY, { value: false, timestamp: 0 });

    expect(getQueryEditorNextPreference()).toBe(false);
  });

  it('returns null when the stored value is not a boolean', () => {
    store.setObject(QUERY_EDITOR_V2_PREFERENCE_KEY, { value: 'false' });

    expect(getQueryEditorNextPreference()).toBeNull();
  });

  it('logs instead of throwing when the preference cannot be saved', () => {
    const setObjectSpy = jest.spyOn(store, 'setObject').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => setQueryEditorNextPreference(true)).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to persist query editor preference', expect.any(Error));

    setObjectSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
