import { clearLastUsedNotebook, getLastUsedNotebook, setLastUsedNotebook } from './lastUsedNotebook';

describe('lastUsedNotebook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips the last used notebook', () => {
    expect(getLastUsedNotebook()).toBeUndefined();

    setLastUsedNotebook('nb123', 'Checkout latency investigation');
    const value = getLastUsedNotebook();
    expect(value?.uid).toBe('nb123');
    expect(value?.title).toBe('Checkout latency investigation');
    expect(value?.at).toBeGreaterThan(0);
  });

  it('ignores empty uids and clears correctly', () => {
    setLastUsedNotebook('', 'nope');
    expect(getLastUsedNotebook()).toBeUndefined();

    setLastUsedNotebook('nb1', 'one');
    clearLastUsedNotebook();
    expect(getLastUsedNotebook()).toBeUndefined();
  });

  it('rejects malformed stored values', () => {
    window.localStorage.setItem('grafana.notebooks.lastUsed', JSON.stringify({ nope: true }));
    expect(getLastUsedNotebook()).toBeUndefined();
  });
});
