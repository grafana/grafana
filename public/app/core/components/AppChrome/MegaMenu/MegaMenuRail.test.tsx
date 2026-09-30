import { render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';

import { MegaMenuRail } from './MegaMenuRail';
import { useNavCustomization } from './hooks';

jest.mock('./hooks', () => ({
  useNavCustomization: jest.fn(),
}));

const dashboardsChild: NavModelItem = { id: 'dashboards/playlists', text: 'Playlists', url: '/playlists' };
const navItems: NavModelItem[] = [
  { id: 'dashboards/browse', text: 'Dashboards', url: '/dashboards', icon: 'apps', children: [dashboardsChild] },
  { id: 'cfg', text: 'Administration', url: '/admin', icon: 'cog' },
  { id: 'alerting', text: 'Alerting', url: '/alerting', icon: 'bell' },
];

describe('MegaMenuRail', () => {
  beforeEach(() => {
    jest
      .mocked(useNavCustomization)
      .mockReturnValue({ navItems, activeItem: dashboardsChild } as unknown as ReturnType<typeof useNavCustomization>);
  });

  it('shows a link per top level section and marks the active one', () => {
    render(<MegaMenuRail />);

    expect(screen.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alerting' })).not.toHaveAttribute('aria-current');
  });

  it('puts administration and the profile menu at the bottom', () => {
    render(<MegaMenuRail />, {
      preloadedState: { navIndex: { profile: { id: 'profile', text: 'Profile', url: '/profile' } } },
    });

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'));
    expect(links.indexOf('Administration')).toBeGreaterThan(links.indexOf('Alerting'));
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
  });

  it('shows the pages of a section in a flyout on hover', async () => {
    const { user } = render(<MegaMenuRail />);

    await user.hover(screen.getByRole('link', { name: 'Dashboards' }));

    expect(await screen.findByRole('link', { name: 'Playlists' })).toHaveAttribute('href', '/playlists');
  });
});
