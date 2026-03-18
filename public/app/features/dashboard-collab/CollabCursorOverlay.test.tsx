import { render, screen, act } from '@testing-library/react';

import { CollabContext, type CollabContextValue } from './CollabContext';
import { CollabCursorOverlay } from './CollabCursorOverlay';
import type { CursorUpdate } from './protocol/messages';

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: { dashboardCollaboration: true },
    bootData: { user: { uid: 'local-user', name: 'Me', gravatarUrl: '' } },
  },
}));

function makeCollabValue(overrides: Partial<CollabContextValue> = {}): CollabContextValue {
  return {
    connected: true,
    users: [],
    locks: [],
    staleLocks: new Set<string>(),
    cursors: new Map(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    sendCursor: jest.fn(),
    sendCheckpoint: jest.fn(),
    ...overrides,
  };
}

function makeCursor(userId: string, displayName: string, x: number, y: number): CursorUpdate {
  return {
    type: 'cursor',
    userId,
    displayName,
    avatarUrl: '',
    color: '#e74c3c',
    x,
    y,
  };
}

function renderWithContext(value: CollabContextValue) {
  return render(
    <CollabContext.Provider value={value}>
      <CollabCursorOverlay />
    </CollabContext.Provider>
  );
}

describe('CollabCursorOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when not connected', () => {
    const value = makeCollabValue({ connected: false });
    const { container } = renderWithContext(value);
    expect(container.firstChild).toBeNull();
  });

  it('renders remote cursor with name label', () => {
    const cursors = new Map<string, CursorUpdate>();
    cursors.set('user-1', makeCursor('user-1', 'Alice', 50, 30));

    const value = makeCollabValue({ cursors });
    renderWithContext(value);

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders multiple remote cursors', () => {
    const cursors = new Map<string, CursorUpdate>();
    cursors.set('user-1', makeCursor('user-1', 'Alice', 50, 30));
    cursors.set('user-2', makeCursor('user-2', 'Bob', 70, 60));

    const value = makeCollabValue({ cursors });
    renderWithContext(value);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('positions cursors using percentage-based left/top', () => {
    const cursors = new Map<string, CursorUpdate>();
    cursors.set('user-1', makeCursor('user-1', 'Alice', 42.5, 67.3));

    const value = makeCollabValue({ cursors });
    renderWithContext(value);

    const label = screen.getByText('Alice');
    const cursorEl = label.parentElement!;
    expect(cursorEl.style.left).toBe('42.5%');
    expect(cursorEl.style.top).toBe('67.3%');
  });

  it('renders cursor arrow SVG', () => {
    const cursors = new Map<string, CursorUpdate>();
    cursors.set('user-1', makeCursor('user-1', 'Alice', 50, 50));

    const value = makeCollabValue({ cursors });
    const { container } = renderWithContext(value);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('sends cursor on document mousemove', () => {
    const sendCursor = jest.fn();
    const value = makeCollabValue({ sendCursor });
    renderWithContext(value);

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));
    });

    expect(sendCursor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'local-user',
      })
    );
  });

  it('does not attach mousemove listener when disconnected', () => {
    const sendCursor = jest.fn();
    const value = makeCollabValue({ connected: false, sendCursor });
    renderWithContext(value);

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }));
    });

    expect(sendCursor).not.toHaveBeenCalled();
  });
});
