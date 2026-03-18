import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollabContext, type CollabContextValue, type CollabUser } from './CollabContext';
import { CollabPresenceBar, type SaveStatus } from './CollabPresenceBar';
import type { CursorUpdate } from './protocol/messages';

function makeUser(id: string, name: string, color: string, avatarUrl = ''): CollabUser {
  return { userId: id, displayName: name, avatarUrl, color };
}

function makeCollabValue(overrides: Partial<CollabContextValue> = {}): CollabContextValue {
  return {
    connected: true,
    users: [],
    locks: [],
    cursors: new Map(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    sendCursor: jest.fn(),
    ...overrides,
  };
}

function renderBar(
  value: CollabContextValue,
  props: { saveStatus?: SaveStatus; onRetrySave?: () => void } = {}
) {
  return render(
    <CollabContext.Provider value={value}>
      <CollabPresenceBar {...props} />
    </CollabContext.Provider>
  );
}

describe('CollabPresenceBar', () => {
  it('renders nothing when not connected', () => {
    const value = makeCollabValue({ connected: false });
    const { container } = renderBar(value);
    expect(container.firstChild).toBeNull();
  });

  it('renders user avatars with initials', () => {
    const value = makeCollabValue({
      users: [makeUser('u1', 'Alice Smith', '#e74c3c'), makeUser('u2', 'Bob', '#2ecc71')],
    });
    renderBar(value);

    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders avatar image when avatarUrl is provided', () => {
    const value = makeCollabValue({
      users: [makeUser('u1', 'Alice', '#e74c3c', 'https://example.com/alice.png')],
    });
    renderBar(value);

    const img = screen.getByAltText('Alice');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/alice.png');
  });

  it('shows +N overflow for more than 5 users', () => {
    const users = Array.from({ length: 8 }, (_, i) => makeUser(`u${i}`, `User ${i}`, '#000'));
    const value = makeCollabValue({ users });
    renderBar(value);

    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('does not show overflow for 5 or fewer users', () => {
    const users = Array.from({ length: 5 }, (_, i) => makeUser(`u${i}`, `User ${i}`, '#000'));
    const value = makeCollabValue({ users });
    renderBar(value);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('shows "Saved" status by default', () => {
    const value = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    renderBar(value);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows "Saving..." status', () => {
    const value = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    renderBar(value, { saveStatus: 'saving' });
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows "Edited" status', () => {
    const value = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    renderBar(value, { saveStatus: 'edited' });
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('shows "Save failed" with retry button', async () => {
    const onRetry = jest.fn();
    const value = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    renderBar(value, { saveStatus: 'failed', onRetrySave: onRetry });

    expect(screen.getByText('Save failed')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when no onRetrySave callback', () => {
    const value = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    renderBar(value, { saveStatus: 'failed' });

    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('removes avatar when user leaves (users list changes)', () => {
    const users = [makeUser('u1', 'Alice', '#e74c3c'), makeUser('u2', 'Bob', '#2ecc71')];
    const value = makeCollabValue({ users });
    const { rerender } = renderBar(value);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    // User leaves
    const updatedValue = makeCollabValue({ users: [makeUser('u1', 'Alice', '#e74c3c')] });
    rerender(
      <CollabContext.Provider value={updatedValue}>
        <CollabPresenceBar />
      </CollabContext.Provider>
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });
});
