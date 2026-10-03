import { render, screen } from 'test/test-utils';

import { type NavIndex } from '@grafana/data';

import { createNavChildrenGroup } from './navChildrenGroup';

const { Component: NavChildrenGroup } = createNavChildrenGroup({
  id: 'nav',
  title: 'Pages',
  navId: 'dashboards/browse',
});

const navIndex: NavIndex = {
  'dashboards/browse': {
    id: 'dashboards/browse',
    text: 'Dashboards',
    children: [
      { id: 'dashboards/playlists', text: 'Playlists', url: '/playlists', icon: 'presentation-play' },
      { id: 'dashboards/snapshots', text: 'Snapshots', url: '/dashboard/snapshots', icon: 'camera' },
      { id: 'dashboards/recently-deleted', text: 'Recently deleted', url: '/dashboard/recently-deleted' },
      { id: 'dashboards/new', text: 'New dashboard', url: '/dashboard/new', isCreateAction: true, hideFromTabs: true },
    ],
  },
};

describe('createNavChildrenGroup', () => {
  it('lists the nav children and marks the current page', () => {
    render(<NavChildrenGroup sectionId="dashboards" pageContext={{}} />, {
      preloadedState: { navIndex },
      historyOptions: { initialEntries: ['/playlists/edit/abc'] },
    });

    expect(screen.getByRole('link', { name: 'Playlists' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Snapshots' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'New dashboard' })).not.toBeInTheDocument();
  });

  it('gives items without an icon a fallback one', () => {
    render(<NavChildrenGroup sectionId="dashboards" pageContext={{}} />, { preloadedState: { navIndex } });

    expect(screen.getByRole('link', { name: 'Recently deleted' }).querySelector('svg')).toBeInTheDocument();
  });

  it('separates the pages from the groups that follow when asked to', () => {
    const { Component: WithDivider } = createNavChildrenGroup({
      id: 'nav',
      title: 'Pages',
      navId: 'dashboards/browse',
      divider: true,
    });
    render(<WithDivider sectionId="dashboards" pageContext={{}} />, { preloadedState: { navIndex } });

    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('has no divider by default', () => {
    render(<NavChildrenGroup sectionId="dashboards" pageContext={{}} />, { preloadedState: { navIndex } });

    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('renders nothing when the nav node is missing', () => {
    render(<NavChildrenGroup sectionId="dashboards" pageContext={{}} />, { preloadedState: { navIndex: {} } });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  describe('nested nav', () => {
    const { Component: AdminGroup } = createNavChildrenGroup({
      id: 'nav',
      title: 'Administration',
      navId: 'cfg',
    });
    const adminNavIndex: NavIndex = {
      cfg: {
        id: 'cfg',
        text: 'Administration',
        children: [
          { id: 'cfg/home', text: 'Overview', url: '/admin', icon: 'home' },
          {
            id: 'cfg/access',
            text: 'Users and access',
            url: '/admin/access',
            icon: 'users-alt',
            children: [{ id: 'teams', text: 'Teams', url: '/admin/access/teams' }],
          },
        ],
      },
    };

    it('expands the group holding the current page and only marks the closest match', () => {
      render(<AdminGroup sectionId="administration" pageContext={{}} />, {
        preloadedState: { navIndex: adminNavIndex },
        historyOptions: { initialEntries: ['/admin/access/teams/new'] },
      });

      expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
      expect(screen.getByRole('button', { name: 'Collapse Users and access' })).toBeInTheDocument();
    });
  });
});
