import { renderHook, act } from '@testing-library/react';
import { Subject, type Observable } from 'rxjs';
import { type PropsWithChildren } from 'react';

import {
  LiveChannelConnectionState,
  LiveChannelEventType,
  type LiveChannelAddress,
  type LiveChannelEvent,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { CollabProvider } from './CollabProvider';
import { useCollab } from './useCollab';
import type { CursorUpdate, ServerMessage } from './protocol/messages';

// --- Mocks ---

const mockPublish = jest.fn().mockResolvedValue(undefined);
let opsSubject: Subject<LiveChannelEvent<ServerMessage>>;
let cursorsSubject: Subject<LiveChannelEvent<CursorUpdate>>;

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getGrafanaLiveSrv: () => ({
      getStream: <T,>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> => {
        if (address.path.endsWith('/ops')) {
          return opsSubject.asObservable() as unknown as Observable<LiveChannelEvent<T>>;
        }
        if (address.path.endsWith('/cursors')) {
          return cursorsSubject.asObservable() as unknown as Observable<LiveChannelEvent<T>>;
        }
        throw new Error(`Unexpected channel: ${address.path}`);
      },
      publish: mockPublish,
      getConnectionState: () => new Subject().asObservable(),
    }),
    config: {
      ...actual.config,
      featureToggles: { dashboardCollaboration: true },
      bootData: { user: { uid: 'local-user-1' } },
    },
  };
});

jest.mock('./opApplicator', () => ({
  applyRemoteOp: jest.fn().mockResolvedValue({ applied: true }),
}));

jest.mock('./opExtractor', () => ({
  extractMutationRequest: jest.fn().mockReturnValue(null),
  setLargeDashboardMode: jest.fn(),
}));

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    warning: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

function makeMockMutationClient(): any {
  return {
    execute: jest.fn().mockResolvedValue({ success: true, changes: [] }),
    getAvailableCommands: jest.fn().mockReturnValue([]),
  };
}

function makeMockScene(): any {
  return {
    state: {
      meta: { provisioned: false },
    },
    subscribeToEvent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    canEditDashboard: jest.fn().mockReturnValue(true),
    onEnterEditMode: jest.fn(),
    forceRender: jest.fn(),
    setState: jest.fn(),
    getMutationClient: jest.fn().mockReturnValue(makeMockMutationClient()),
  };
}

function makeWrapper(scene: any) {
  return ({ children }: PropsWithChildren) => (
    <CollabProvider scene={scene} dashboardUID="test-uid" namespace="default">
      {children}
    </CollabProvider>
  );
}

describe('CollabProvider', () => {
  beforeEach(() => {
    opsSubject = new Subject();
    cursorsSubject = new Subject();
    mockPublish.mockClear();
    config.featureToggles.dashboardCollaboration = true;
  });

  it('provides default disconnected state', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    expect(result.current.connected).toBe(false);
    expect(result.current.users).toEqual([]);
    expect(result.current.locks).toEqual([]);
  });

  it('sets connected and populates initial session on status event', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    act(() => {
      opsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'grafana/collab/default/test-uid/ops',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Connected,
        message: {
          users: [{ userId: 'u1', displayName: 'Alice', avatarUrl: '', color: '#e74c3c' }],
          locks: { 'panel-1': 'u1' },
          seq: 5,
        },
      });
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].displayName).toBe('Alice');
    expect(result.current.locks).toEqual([{ target: 'panel-1', userId: 'u1' }]);
  });

  it('sets connected to false on disconnect', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    act(() => {
      opsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'test',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Connected,
        message: { users: [], locks: {}, seq: 0 },
      });
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      opsSubject.next({
        type: LiveChannelEventType.Status,
        id: 'test',
        timestamp: Date.now(),
        state: LiveChannelConnectionState.Disconnected,
      });
    });
    expect(result.current.connected).toBe(false);
  });

  it('updates locks on lock messages', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    // Acquire lock
    act(() => {
      opsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          seq: 1,
          kind: 'lock',
          op: { type: 'lock', target: 'panel-2', userId: 'u2' },
          userId: 'u2',
          timestamp: Date.now(),
        } as ServerMessage,
      });
    });
    expect(result.current.locks).toEqual([{ target: 'panel-2', userId: 'u2' }]);

    // Release lock
    act(() => {
      opsSubject.next({
        type: LiveChannelEventType.Message,
        message: {
          seq: 2,
          kind: 'lock',
          op: { type: 'unlock', target: 'panel-2', userId: 'u2' },
          userId: 'u2',
          timestamp: Date.now(),
        } as ServerMessage,
      });
    });
    expect(result.current.locks).toEqual([]);
  });

  it('acquireLock publishes a lock message', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    act(() => {
      result.current.acquireLock('panel-3');
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'default/test-uid/ops' }),
      expect.objectContaining({
        kind: 'lock',
        op: expect.objectContaining({ type: 'lock', target: 'panel-3' }),
      })
    );
  });

  it('releaseLock publishes an unlock message', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    act(() => {
      result.current.releaseLock('panel-3');
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'default/test-uid/ops' }),
      expect.objectContaining({
        kind: 'lock',
        op: expect.objectContaining({ type: 'unlock', target: 'panel-3' }),
      })
    );
  });

  it('receives cursor updates from other users', () => {
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

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
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

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
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

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

  it('is a no-op when feature toggle is disabled', () => {
    config.featureToggles.dashboardCollaboration = false;
    const scene = makeMockScene();
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    expect(result.current.connected).toBe(false);
    // Should not have subscribed — publish should be no-op
    act(() => {
      result.current.acquireLock('panel-1');
    });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('is a no-op when dashboard is provisioned', () => {
    const scene = makeMockScene();
    scene.state.meta.provisioned = true;
    const { result } = renderHook(() => useCollab(), { wrapper: makeWrapper(scene) });

    expect(result.current.connected).toBe(false);
    act(() => {
      result.current.acquireLock('panel-1');
    });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
