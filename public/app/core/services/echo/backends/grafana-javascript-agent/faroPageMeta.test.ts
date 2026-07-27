import { type Faro } from '@grafana/faro-core';
import { PersistentSessionsManager, VolatileSessionsManager } from '@grafana/faro-web-sdk';
import { locationService } from '@grafana/runtime';

import { setupFaroPageMeta } from './faroPageMeta';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn(),
    getHistory: jest.fn(),
  },
}));

jest.mock('@grafana/faro-web-sdk', () => ({
  PersistentSessionsManager: { fetchUserSession: jest.fn() },
  VolatileSessionsManager: { fetchUserSession: jest.fn() },
}));

const getLocationMock = jest.mocked(locationService.getLocation);
const getHistoryMock = jest.mocked(locationService.getHistory);
const persistentFetchMock = jest.mocked(PersistentSessionsManager.fetchUserSession);
const volatileFetchMock = jest.mocked(VolatileSessionsManager.fetchUserSession);

const SESSION_START = 1_700_000_000_000;

type StoredSession = { sessionId: string; started: number } | null;

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

function mockStoredSessions(persistent: StoredSession, volatile: StoredSession = null) {
  persistentFetchMock.mockReturnValue(persistent as ReturnType<typeof PersistentSessionsManager.fetchUserSession>);
  volatileFetchMock.mockReturnValue(volatile as ReturnType<typeof VolatileSessionsManager.fetchUserSession>);
}

describe('setupFaroPageMeta', () => {
  let setPage: jest.Mock;
  let getSession: jest.Mock;
  let faro: Faro;
  let navigate: (location: { pathname: string; state?: unknown }, action?: 'PUSH' | 'REPLACE' | 'POP') => void;

  beforeEach(() => {
    jest.clearAllMocks();

    setPage = jest.fn();
    getSession = jest.fn().mockReturnValue({ id: 'session-1' });
    faro = { api: { setPage, getSession } } as unknown as Faro;

    getLocationMock.mockReturnValue({ pathname: '/search' } as ReturnType<typeof locationService.getLocation>);
    getHistoryMock.mockReturnValue({
      listen: (listener: (location: { pathname: string; state?: unknown }, action: string) => void) => {
        navigate = (location, action = 'PUSH') => listener(location, action);
        return () => {};
      },
    } as unknown as ReturnType<typeof locationService.getHistory>);

    mockStoredSessions({ sessionId: 'session-1', started: SESSION_START });
  });

  it('attaches referrer and sessionStart, omits previousUrl on the landing page', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { referrer: 'https://issues.example.com/123', sessionStart: String(SESSION_START) },
    });
  });

  it('reports the previous route as previousUrl on subsequent internal navigations', () => {
    setReferrer('https://issues.example.com/123');

    setupFaroPageMeta(faro);
    navigate({ pathname: '/d/abc' });

    expect(setPage).toHaveBeenCalledTimes(2);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: {
        referrer: 'https://issues.example.com/123',
        previousUrl: '/search',
        sessionStart: String(SESSION_START),
      },
    });

    navigate({ pathname: '/d/xyz' });

    expect(setPage).toHaveBeenCalledTimes(3);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: {
        referrer: 'https://issues.example.com/123',
        previousUrl: '/d/abc',
        sessionStart: String(SESSION_START),
      },
    });
  });

  it('does not shift the navigation chain on query-only history updates', () => {
    setReferrer('');

    setupFaroPageMeta(faro);
    navigate({ pathname: '/d/abc' });

    // Same pathname again: scenes URL sync writing time range/variables into the query string.
    navigate({ pathname: '/d/abc' });

    // Still re-emits (page.url must track the query string), but previousUrl is unchanged.
    expect(setPage).toHaveBeenCalledTimes(3);
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { previousUrl: '/search', sessionStart: String(SESSION_START) },
    });

    // A real navigation afterwards reports the dashboard, not a self-reference.
    navigate({ pathname: '/d/xyz' });

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { previousUrl: '/d/abc', sessionStart: String(SESSION_START) },
    });
  });

  it('does not shift the navigation chain when a flagged URL rewrite replaces the current entry', () => {
    setReferrer('');

    setupFaroPageMeta(faro);
    navigate({ pathname: '/d/abc/stale-slug' });

    // Slug normalization after the dashboard loads: the URL is replaced with the canonical slug.
    navigate({ pathname: '/d/abc/canonical-slug', state: { urlRewrite: true } }, 'REPLACE');

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { previousUrl: '/search', sessionStart: String(SESSION_START) },
    });

    // A later real navigation reports the canonical path, not the stale slug.
    navigate({ pathname: '/d/xyz' });

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { previousUrl: '/d/abc/canonical-slug', sessionStart: String(SESSION_START) },
    });
  });

  it('treats an unflagged REPLACE as a navigation (redirect round-trips)', () => {
    setReferrer('');

    setupFaroPageMeta(faro);
    navigate({ pathname: '/alerting/new' });

    // Saving replaces the editor with the list - a real transition, not a URL rewrite.
    // Without the shift, previousUrl would be the pre-editor path: /search -> self-reference
    // whenever the flow returns to where it started.
    navigate({ pathname: '/alerting/list' }, 'REPLACE');

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { previousUrl: '/alerting/new', sessionStart: String(SESSION_START) },
    });
  });

  it('keeps previousUrl absent when the landing page URL is rewritten (home-route resolution)', () => {
    setReferrer('');
    getLocationMock.mockReturnValue({ pathname: '/' } as ReturnType<typeof locationService.getLocation>);

    setupFaroPageMeta(faro);
    navigate({ pathname: '/d/home-dash/home', state: { urlRewrite: true } }, 'REPLACE');

    // Still a landing page: no previousUrl means session entry point for the receiver.
    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { sessionStart: String(SESSION_START) },
    });
  });

  it('omits referrer on direct navigations (empty document.referrer)', () => {
    setReferrer('');

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { sessionStart: String(SESSION_START) },
    });
  });

  it('omits sessionStart when no stored session matches the live session id', () => {
    setReferrer('');
    // Stale record from a previous storage configuration: present but for a dead session.
    mockStoredSessions({ sessionId: 'dead-session', started: 12345 });

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenLastCalledWith({ url: window.location.href, attributes: {} });
  });

  it('omits sessionStart when Faro has no active session', () => {
    setReferrer('');
    getSession.mockReturnValue(undefined);

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenLastCalledWith({ url: window.location.href, attributes: {} });
  });

  it('falls back to volatile storage when the persistent record does not match', () => {
    setReferrer('');
    mockStoredSessions(
      { sessionId: 'dead-session', started: 12345 },
      { sessionId: 'session-1', started: SESSION_START }
    );

    setupFaroPageMeta(faro);

    expect(setPage).toHaveBeenLastCalledWith({
      url: window.location.href,
      attributes: { sessionStart: String(SESSION_START) },
    });
  });

  describe('refresh callback (session rotation without navigation)', () => {
    it('re-anchors sessionStart without shifting the navigation chain', () => {
      setReferrer('');

      const refresh = setupFaroPageMeta(faro);
      navigate({ pathname: '/d/abc' });
      expect(setPage).toHaveBeenLastCalledWith({
        url: window.location.href,
        attributes: { previousUrl: '/search', sessionStart: String(SESSION_START) },
      });

      const rotatedStart = SESSION_START + 60_000;
      getSession.mockReturnValue({ id: 'session-2' });
      mockStoredSessions({ sessionId: 'session-2', started: rotatedStart });
      refresh();

      expect(setPage).toHaveBeenCalledTimes(3);
      // previousUrl unchanged: the rotation is not a navigation.
      expect(setPage).toHaveBeenLastCalledWith({
        url: window.location.href,
        attributes: { previousUrl: '/search', sessionStart: String(rotatedStart) },
      });
    });

    it('is a noop when the session start has not changed (session extends)', () => {
      setReferrer('');

      const refresh = setupFaroPageMeta(faro);
      expect(setPage).toHaveBeenCalledTimes(1);

      refresh();

      expect(setPage).toHaveBeenCalledTimes(1);
    });
  });
});
