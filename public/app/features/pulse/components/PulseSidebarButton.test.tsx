import { render, screen } from '@testing-library/react';
import React from 'react';

import { Sidebar, useSidebar } from '@grafana/ui';

import { PulseSidebarButton } from './PulseSidebarButton';

// Mock the RTK hook so each test can control the unread count
// without spinning up a real store / network round trip.
const useGetResourceUnreadCountQueryMock = jest.fn();

jest.mock('../api/pulseApi', () => ({
  useGetResourceUnreadCountQuery: (...args: unknown[]) => useGetResourceUnreadCountQueryMock(...args),
}));

// The live channel subscription is fire-and-forget; replacing it
// with a no-op keeps the test focused on the badge surface without
// pulling in Grafana Live infra.
jest.mock('../hooks/useResourcePulseStream', () => ({
  useResourcePulseStream: jest.fn(),
}));

// Sidebar.Button requires the SidebarContext to be populated, so we
// hoist the standard useSidebar setup into a small harness. Matches
// the pattern used by Sidebar's own tests.
function SidebarHarness({ children }: { children: React.ReactNode }) {
  const contextValue = useSidebar({
    position: 'right',
    hasOpenPane: false,
    onClosePane: () => {},
  });
  return (
    <Sidebar contextValue={contextValue}>
      <Sidebar.Toolbar>{children}</Sidebar.Toolbar>
    </Sidebar>
  );
}

function renderInSidebar(node: React.ReactNode) {
  return render(<SidebarHarness>{node}</SidebarHarness>);
}

beforeEach(() => {
  useGetResourceUnreadCountQueryMock.mockReset();
});

describe('PulseSidebarButton', () => {
  it('renders the Pulse sidebar button without a badge when the unread count is zero', () => {
    useGetResourceUnreadCountQueryMock.mockReturnValue({ data: { unreadCount: 0 } });

    renderInSidebar(<PulseSidebarButton resourceUID="dash-1" onClick={() => {}} />);

    expect(screen.getByTestId('pulse-sidebar-button')).toBeInTheDocument();
    // No badge bubble surfaces — a quiet dashboard should not grow a
    // "0" pill that begs to be clicked.
    expect(screen.queryByTestId('pulse-sidebar-unread-badge')).not.toBeInTheDocument();
  });

  it('renders the unread badge with the count when the dashboard has unread activity', () => {
    useGetResourceUnreadCountQueryMock.mockReturnValue({ data: { unreadCount: 3 } });

    renderInSidebar(<PulseSidebarButton resourceUID="dash-1" onClick={() => {}} />);

    const badge = screen.getByTestId('pulse-sidebar-unread-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('3');
  });

  it('caps the badge label at "99+" but keeps the precise count in the aria-label for screen readers', () => {
    useGetResourceUnreadCountQueryMock.mockReturnValue({ data: { unreadCount: 247 } });

    renderInSidebar(<PulseSidebarButton resourceUID="dash-1" onClick={() => {}} />);

    const badge = screen.getByTestId('pulse-sidebar-unread-badge');
    expect(badge.textContent).toBe('99+');
    // The aria-label still announces the exact value so a user
    // relying on a screen reader hears the real count rather than
    // the truncated visual.
    expect(badge.getAttribute('aria-label')).toContain('247');
  });

  it('skips the count query and renders no badge when the dashboard has no resource UID yet', () => {
    useGetResourceUnreadCountQueryMock.mockReturnValue({ data: undefined });

    renderInSidebar(<PulseSidebarButton resourceUID={undefined} onClick={() => {}} />);

    expect(screen.getByTestId('pulse-sidebar-button')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-sidebar-unread-badge')).not.toBeInTheDocument();
    // The hook is called with skip=true so RTK never opens the
    // request — the assertion below would catch a regression that
    // dropped the skip guard.
    expect(useGetResourceUnreadCountQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ resourceKind: 'dashboard', resourceUID: '' }),
      expect.objectContaining({ skip: true })
    );
  });
});
