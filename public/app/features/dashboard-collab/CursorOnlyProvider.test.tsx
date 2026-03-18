import { renderHook, act } from '@testing-library/react';
import { Subject, type Observable } from 'rxjs';
import { type PropsWithChildren } from 'react';

import {
  LiveChannelConnectionState,
  LiveChannelEventType,
  type LiveChannelEvent,
} from '@grafana/data';

import { CursorOnlyProvider } from './CursorOnlyProvider';
import { useCollab } from './useCollab';
import type { CursorUpdate } from './protocol/messages';

// --- Mocks ---

const mockPublish = jest.fn().mockResolvedValue(undefined);
let cursorsSubject: Subject<LiveChannelEvent<CursorUpdate>>;

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getGrafanaLiveSrv: () => ({
      getStream: <T,>(): Observable<LiveChannelEvent<T>> => {
        return cursorsSubject.asObservable() as unknown as Observable<LiveChannelEvent<T>>;
      },
      publish: mockPublish,
    }),
    config: {
      ...actual.config,
      featureToggles: { dashboardCursorSync: true },
      bootData: { user: { uid: 'local-user-1' } },
    },
  };
});

function makeWrapper() {
  return ({ children }: PropsWithChildren) => (
    <CursorOnlyProvider dashboardUID="test-uid" namespace="default">
      {children}
    </CursorOnlyProvider>
  );
}

describe('CursorOnlyProvider', () => {
  beforeEach(() => {
    cursorsSubject = new Subject();
    mockPublish.mockClear();
  });

  it('provides default disconnected state with empty collab values', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    expect(result.current.connected).toBe(false);
    expect(result.current.users).toEqual([]);
    expect(result.current.locks).toEqual([]);
    expect(result.current.cursors.size).toBe(0);
  });

  it('sets connected on status event', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'grafana/collab/default/test-uid/cursors',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Connected,
      });
    });

    expect(result.current.connected).toBe(true);
  });

  it('sets connected to false on disconnect', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'test',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Connected,
      });
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'test',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Disconnected,
      });
    });
    expect(result.current.connected).toBe(false);
  });

  it('receives cursor updates from other users', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    const cursorUpdate: CursorUpdate = {
      type: 'cursor',
      userId: 'remote-user',
      displayName: 'Bob',
      avatarUrl: '',
      color: '#2ecc71',
      x: 100,
      y: 200,
      panelId: 'panel-1',
    };

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: cursorUpdate,
      });
    });

    expect(result.current.cursors.size).toBe(1);
    expect(result.current.cursors.get('remote-user')).toEqual(cursorUpdate);
  });

  it('ignores cursor updates from local user', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          type: 'cursor',
          userId: 'local-user-1',
          displayName: 'Me',
          avatarUrl: '',
          color: '#fff',
          x: 0,
          y: 0,
        },
      });
    });

    expect(result.current.cursors.size).toBe(0);
  });

  it('sendCursor publishes to cursors channel', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      result.current.sendCursor({
        userId: 'local-user-1',
        displayName: 'Me',
        avatarUrl: '',
        color: '#fff',
        x: 50,
        y: 75,
      });
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'default/test-uid/cursors' }),
      expect.objectContaining({ type: 'cursor', x: 50, y: 75 })
    );
  });

  it('acquireLock and releaseLock are no-ops', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    // These should not throw
    act(() => {
      result.current.acquireLock('panel-1');
      result.current.releaseLock('panel-1');
    });

    // No publish call for locks — CursorOnlyProvider doesn't support them
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('sendCheckpoint is a no-op', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      result.current.sendCheckpoint('my save');
    });

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('accumulates cursors from multiple users', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          type: 'cursor',
          userId: 'user-a',
          displayName: 'Alice',
          avatarUrl: '',
          color: '#e74c3c',
          x: 10,
          y: 20,
        },
      });
    });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          type: 'cursor',
          userId: 'user-b',
          displayName: 'Bob',
          avatarUrl: '',
          color: '#2ecc71',
          x: 30,
          y: 40,
        },
      });
    });

    expect(result.current.cursors.size).toBe(2);
    expect(result.current.cursors.get('user-a')?.x).toBe(10);
    expect(result.current.cursors.get('user-b')?.x).toBe(30);
  });

  it('updates cursor position for existing user', () => {
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper() });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          type: 'cursor',
          userId: 'user-a',
          displayName: 'Alice',
          avatarUrl: '',
          color: '#e74c3c',
          x: 10,
          y: 20,
        },
      });
    });

    act(() => {
      cursorsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          type: 'cursor',
          userId: 'user-a',
          displayName: 'Alice',
          avatarUrl: '',
          color: '#e74c3c',
          x: 999,
          y: 888,
        },
      });
    });

    expect(result.current.cursors.size).toBe(1);
    expect(result.current.cursors.get('user-a')?.x).toBe(999);
    expect(result.current.cursors.get('user-a')?.y).toBe(888);
  });
});
