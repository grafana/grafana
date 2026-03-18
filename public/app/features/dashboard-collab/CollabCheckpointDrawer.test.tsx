import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollabContext, type CollabContextValue } from './CollabContext';
import { CollabCheckpointDrawer } from './CollabCheckpointDrawer';

// --- Mocks ---
const mockSuccess = jest.fn();
const mockWarning = jest.fn();

jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    success: mockSuccess,
    warning: mockWarning,
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

const mockSendCheckpoint = jest.fn();
const mockSetState = jest.fn();

function makeCollabValue(overrides: Partial<CollabContextValue> = {}): CollabContextValue {
  return {
    connected: true,
    users: [],
    locks: [],
    cursors: new Map(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    sendCursor: jest.fn(),
    sendCheckpoint: mockSendCheckpoint,
    ...overrides,
  };
}

function makeMockDashboard() {
  return {
    state: { title: 'Test Dashboard', overlay: {} },
    setState: mockSetState,
    getRef: jest.fn().mockReturnValue({
      resolve: jest.fn(),
    }),
  } as any;
}

function renderDrawer(collabValue: CollabContextValue) {
  const dashboard = makeMockDashboard();
  const drawer = new CollabCheckpointDrawer({
    dashboardRef: { resolve: () => dashboard } as any,
  });

  return render(
    <CollabContext.Provider value={collabValue}>
      <drawer.Component model={drawer} />
    </CollabContext.Provider>
  );
}

describe('CollabCheckpointDrawer', () => {
  beforeEach(() => {
    mockSendCheckpoint.mockClear();
    mockSuccess.mockClear();
    mockWarning.mockClear();
    mockSetState.mockClear();
  });

  it('renders the version name input and save button', () => {
    renderDrawer(makeCollabValue());

    expect(screen.getByTestId('collab-checkpoint-message')).toBeInTheDocument();
    expect(screen.getByTestId('collab-checkpoint-save')).toBeInTheDocument();
  });

  it('sends checkpoint with message on save', async () => {
    const user = userEvent.setup();
    renderDrawer(makeCollabValue());

    const input = screen.getByTestId('collab-checkpoint-message');
    await user.type(input, 'Added latency panel');

    const saveButton = screen.getByTestId('collab-checkpoint-save');
    await user.click(saveButton);

    expect(mockSendCheckpoint).toHaveBeenCalledWith('Added latency panel');
    expect(mockSuccess).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Added latency panel')
    );
  });

  it('sends checkpoint with undefined message when input is empty', async () => {
    const user = userEvent.setup();
    renderDrawer(makeCollabValue());

    const saveButton = screen.getByTestId('collab-checkpoint-save');
    await user.click(saveButton);

    expect(mockSendCheckpoint).toHaveBeenCalledWith(undefined);
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('shows warning when not connected', async () => {
    const user = userEvent.setup();
    renderDrawer(makeCollabValue({ connected: false }));

    const saveButton = screen.getByTestId('collab-checkpoint-save');
    // Button should be disabled when not connected
    expect(saveButton).toBeDisabled();
  });

  it('sends checkpoint on Enter key', async () => {
    const user = userEvent.setup();
    renderDrawer(makeCollabValue());

    const input = screen.getByTestId('collab-checkpoint-message');
    await user.type(input, 'Quick fix{Enter}');

    expect(mockSendCheckpoint).toHaveBeenCalledWith('Quick fix');
  });

  it('closes drawer on cancel', async () => {
    const user = userEvent.setup();
    const dashboard = makeMockDashboard();
    const drawer = new CollabCheckpointDrawer({
      dashboardRef: { resolve: () => dashboard } as any,
    });

    render(
      <CollabContext.Provider value={makeCollabValue()}>
        <drawer.Component model={drawer} />
      </CollabContext.Provider>
    );

    // Find the Cancel button by text
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(dashboard.setState).toHaveBeenCalledWith({ overlay: undefined });
  });
});
