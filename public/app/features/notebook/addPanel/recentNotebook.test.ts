import { act, renderHook } from '@testing-library/react';

import { store } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

import { clearRecentNotebook, getRecentNotebook, setRecentNotebook, useRecentNotebookVersion } from './recentNotebook';

jest.mock('app/core/services/context_srv');

describe('recent notebook destination', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T12:00:00Z'));
    contextSrv.user.id = 12;
    contextSrv.user.orgId = 34;
    clearRecentNotebook();
  });

  afterEach(() => {
    act(() => clearRecentNotebook());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('remembers a successful add across reads for the current user and org', () => {
    setRecentNotebook('nb1', 'Investigation');

    expect(getRecentNotebook()).toEqual({ uid: 'nb1', title: 'Investigation', at: Date.parse('2026-09-24T12:00:00Z') });

    contextSrv.user.id = 13;
    expect(getRecentNotebook()).toBeUndefined();
    contextSrv.user.id = 12;
    contextSrv.user.orgId = 35;
    expect(getRecentNotebook()).toBeUndefined();
    contextSrv.user.orgId = 34;
    expect(getRecentNotebook()?.uid).toBe('nb1');
  });

  it('expires after four hours and refreshes only when set again', () => {
    setRecentNotebook('nb1', 'Investigation');
    jest.setSystemTime(new Date('2026-09-24T15:59:59Z'));
    expect(getRecentNotebook()?.uid).toBe('nb1');

    jest.setSystemTime(new Date('2026-09-24T16:00:00Z'));
    expect(getRecentNotebook()).toBeUndefined();

    setRecentNotebook('nb2', 'New investigation');
    expect(getRecentNotebook()?.uid).toBe('nb2');
  });

  it('ignores malformed and future-dated destinations', () => {
    store.setObject('grafana.notebooks.recentAdd.34.12', { uid: 'nb1', title: 'Investigation', at: 'yesterday' });
    expect(getRecentNotebook()).toBeUndefined();

    store.setObject('grafana.notebooks.recentAdd.34.12', {
      uid: 'nb1',
      title: 'Investigation',
      at: Date.parse('2026-09-24T12:01:00Z'),
    });
    expect(getRecentNotebook()).toBeUndefined();
  });

  it('does not let unavailable local storage fail a successful add', () => {
    jest.spyOn(store, 'setObject').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    setRecentNotebook('nb1', 'Investigation');
    expect(getRecentNotebook()).toBeUndefined();
  });

  it('updates the Explore extension when an add succeeds and when the shortcut expires', () => {
    const { result } = renderHook(() => useRecentNotebookVersion());
    expect(result.current).toBeUndefined();

    act(() => setRecentNotebook('nb1', 'Investigation'));
    expect(result.current).toBe('1790251200000.0');

    act(() => jest.advanceTimersByTime(4 * 60 * 60 * 1000));
    expect(result.current).toBeUndefined();
  });
});
