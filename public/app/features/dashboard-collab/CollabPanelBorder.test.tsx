import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

import { CollabContext, type CollabContextValue, type CollabLock, type CollabUser } from './CollabContext';
import { CollabPanelBorder, useCollabEditGuard } from './CollabPanelBorder';

// --- Mock appNotification ---
const mockWarning = jest.fn();
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    warning: mockWarning,
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      bootData: { user: { uid: 'local-user' } },
      theme2: actual.config.theme2,
    },
  };
});

const mockAcquireLock = jest.fn();
const mockReleaseLock = jest.fn();

function makeCollabValue(overrides: Partial<CollabContextValue> = {}): CollabContextValue {
  return {
    connected: true,
    users: [],
    locks: [],
    staleLocks: new Set<string>(),
    cursors: new Map(),
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
    sendCursor: jest.fn(),
    sendCheckpoint: jest.fn(),
    ...overrides,
  };
}

function renderWithCollab(ui: React.ReactElement, collabValue: CollabContextValue) {
  return render(
    <CollabContext.Provider value={collabValue}>
      {ui}
    </CollabContext.Provider>
  );
}

const alice: CollabUser = {
  userId: 'alice',
  displayName: 'Alice',
  avatarUrl: 'https://example.com/alice.png',
  color: '#e74c3c',
};

const bob: CollabUser = {
  userId: 'bob',
  displayName: 'Bob',
  avatarUrl: '',
  color: '#2ecc71',
};

const localUser: CollabUser = {
  userId: 'local-user',
  displayName: 'Me',
  avatarUrl: '',
  color: '#3498db',
};

describe('CollabPanelBorder', () => {
  beforeEach(() => {
    mockAcquireLock.mockClear();
    mockReleaseLock.mockClear();
    mockWarning.mockClear();
  });

  it('renders children without border when no lock exists', () => {
    const value = makeCollabValue();
    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={false}>
        <div data-testid="child">Panel content</div>
      </CollabPanelBorder>,
      value
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('collab-panel-border')).toBeInTheDocument();
    // No badge should be rendered
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders children pass-through when not connected', () => {
    const value = makeCollabValue({ connected: false });
    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={false}>
        <div data-testid="child">Panel content</div>
      </CollabPanelBorder>,
      value
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    // No wrapper div when disconnected
    expect(screen.queryByTestId('collab-panel-border')).not.toBeInTheDocument();
  });

  it('shows colored border and avatar badge when locked by another user', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'alice' };
    const value = makeCollabValue({ locks: [lock], users: [alice, localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={false}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    const wrapper = screen.getByTestId('collab-panel-border');
    expect(wrapper).toBeInTheDocument();

    // Avatar image should be shown
    const avatar = screen.getByAltText('Alice');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/alice.png');
  });

  it('shows initial when lock holder has no avatar', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'bob' };
    const value = makeCollabValue({ locks: [lock], users: [bob, localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={false}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    // Should show initial "B" for Bob
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('does not show badge for own lock', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'local-user' };
    const value = makeCollabValue({ locks: [lock], users: [localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={true}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    // No badge for own lock
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  it('acquires lock when entering edit mode', () => {
    const value = makeCollabValue({ users: [localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={true}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    expect(mockAcquireLock).toHaveBeenCalledWith('panel-1');
  });

  it('releases lock when leaving edit mode', () => {
    const value = makeCollabValue({ users: [localUser] });

    const { rerender } = renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={true}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    expect(mockAcquireLock).toHaveBeenCalledWith('panel-1');

    rerender(
      <CollabContext.Provider value={value}>
        <CollabPanelBorder panelId="panel-1" isEditing={false}>
          <div>Panel content</div>
        </CollabPanelBorder>
      </CollabContext.Provider>
    );

    expect(mockReleaseLock).toHaveBeenCalledWith('panel-1');
  });

  it('does not acquire lock when not connected', () => {
    const value = makeCollabValue({ connected: false, users: [localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={true}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    expect(mockAcquireLock).not.toHaveBeenCalled();
  });

  it('does not render border for unrelated locks', () => {
    const lock: CollabLock = { target: 'panel-99', userId: 'alice' };
    const value = makeCollabValue({ locks: [lock], users: [alice, localUser] });

    renderWithCollab(
      <CollabPanelBorder panelId="panel-1" isEditing={false}>
        <div>Panel content</div>
      </CollabPanelBorder>,
      value
    );

    // No badge for a lock on a different panel
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('useCollabEditGuard', () => {
  beforeEach(() => {
    mockWarning.mockClear();
  });

  function wrapper(value: CollabContextValue) {
    return ({ children }: { children: React.ReactNode }) => (
      <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
    );
  }

  it('returns isLockedByOther=false and guardEdit=true when no lock', () => {
    const value = makeCollabValue();
    const { result } = renderHook(() => useCollabEditGuard('panel-1'), {
      wrapper: wrapper(value),
    });

    expect(result.current.isLockedByOther).toBe(false);
    expect(result.current.guardEdit()).toBe(true);
    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('returns isLockedByOther=true and shows toast when locked by another user', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'alice' };
    const value = makeCollabValue({ locks: [lock], users: [alice, localUser] });

    const { result } = renderHook(() => useCollabEditGuard('panel-1'), {
      wrapper: wrapper(value),
    });

    expect(result.current.isLockedByOther).toBe(true);
    expect(result.current.guardEdit()).toBe(false);
    expect(mockWarning).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Alice')
    );
  });

  it('returns isLockedByOther=false for own lock', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'local-user' };
    const value = makeCollabValue({ locks: [lock], users: [localUser] });

    const { result } = renderHook(() => useCollabEditGuard('panel-1'), {
      wrapper: wrapper(value),
    });

    expect(result.current.isLockedByOther).toBe(false);
    expect(result.current.guardEdit()).toBe(true);
  });

  it('returns isLockedByOther=false when not connected', () => {
    const lock: CollabLock = { target: 'panel-1', userId: 'alice' };
    const value = makeCollabValue({ connected: false, locks: [lock], users: [alice] });

    const { result } = renderHook(() => useCollabEditGuard('panel-1'), {
      wrapper: wrapper(value),
    });

    expect(result.current.isLockedByOther).toBe(false);
  });
});
