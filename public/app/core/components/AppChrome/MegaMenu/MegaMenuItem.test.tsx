import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { MegaMenu } from './MegaMenu';

const mockUseEmptyDashboardNavItems = jest.fn();
jest.mock('./useEmptyDashboardNavItems', () => ({
  ...jest.requireActual('./useEmptyDashboardNavItems'),
  useEmptyDashboardNavItems: (...args: unknown[]) => mockUseEmptyDashboardNavItems(...args),
}));

const setup = () => {
  const navBarTree: NavModelItem[] = [
    {
      text: 'Dashboards',
      id: 'dashboards/browse',
      url: '/dashboards',
      children: [
        { text: 'Playlists', id: 'dashboards/playlists', url: '/playlists' },
        { text: 'Snapshots', id: 'dashboards/snapshots', url: '/dashboard/snapshots' },
        { text: 'Library panels', id: 'dashboards/library-panels', url: '/library-panels' },
        { text: 'Shared dashboards', id: 'dashboards/public', url: '/dashboard/public' },
        { text: 'Recently deleted', id: 'dashboards/recently-deleted', url: '/dashboard/recently-deleted' },
      ],
    },
  ];
  const store = configureStore({ navBarTree });
  return render(<MegaMenu onClose={() => {}} />, { store });
};

describe('MegaMenuItem dashboards filtering', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('hides child items whose IDs are returned by useEmptyDashboardNavItems', async () => {
    mockUseEmptyDashboardNavItems.mockReturnValue(new Set(['dashboards/snapshots', 'dashboards/public']));
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));

    expect(await screen.findByRole('link', { name: 'Playlists' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library panels' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recently deleted' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Snapshots' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Shared dashboards' })).not.toBeInTheDocument();
  });

  it('shows every child when the hidden set is empty', async () => {
    mockUseEmptyDashboardNavItems.mockReturnValue(new Set<string>());
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));

    for (const name of ['Playlists', 'Snapshots', 'Library panels', 'Shared dashboards', 'Recently deleted']) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument();
    }
  });
});
