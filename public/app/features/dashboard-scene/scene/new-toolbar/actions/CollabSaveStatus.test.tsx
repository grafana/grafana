import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CollabContext, type CollabContextValue } from 'app/features/dashboard-collab/CollabContext';

import { CollabSaveStatus } from './CollabSaveStatus';

function makeCollabValue(overrides: Partial<CollabContextValue> = {}): CollabContextValue {
  return {
    connected: true,
    users: [],
    locks: [],
    cursors: new Map(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    sendCursor: jest.fn(),
    sendCheckpoint: jest.fn(),
    ...overrides,
  };
}

function makeDashboardMock(overrides: Record<string, any> = {}) {
  return {
    useState: () => ({
      isDirty: false,
      ...overrides,
    }),
    openSaveDrawer: jest.fn(),
  } as any;
}

function renderStatus(
  collabValue: CollabContextValue,
  dashboardOverrides: Record<string, any> = {}
) {
  const dashboard = makeDashboardMock(dashboardOverrides);
  return {
    dashboard,
    ...render(
      <CollabContext.Provider value={collabValue}>
        <CollabSaveStatus dashboard={dashboard} />
      </CollabContext.Provider>
    ),
  };
}

describe('CollabSaveStatus', () => {
  it('shows "Saved" when connected and not dirty', () => {
    renderStatus(makeCollabValue());
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByTestId('collab-save-status')).toBeInTheDocument();
  });

  it('shows "Edited" when connected and dirty', () => {
    renderStatus(makeCollabValue(), { isDirty: true });
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('shows "Save failed" when not connected', () => {
    renderStatus(makeCollabValue({ connected: false }));
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });

  it('shows retry button when save failed', () => {
    renderStatus(makeCollabValue({ connected: false }));
    expect(screen.getByTestId('collab-save-retry')).toBeInTheDocument();
  });

  it('does not show retry button when saved', () => {
    renderStatus(makeCollabValue());
    expect(screen.queryByTestId('collab-save-retry')).not.toBeInTheDocument();
  });

  it('does not show retry button when edited', () => {
    renderStatus(makeCollabValue(), { isDirty: true });
    expect(screen.queryByTestId('collab-save-retry')).not.toBeInTheDocument();
  });

  it('calls openSaveDrawer when retry is clicked', async () => {
    const { dashboard } = renderStatus(makeCollabValue({ connected: false }));
    const retry = screen.getByTestId('collab-save-retry');
    await userEvent.click(retry);
    expect(dashboard.openSaveDrawer).toHaveBeenCalledWith({});
  });
});
