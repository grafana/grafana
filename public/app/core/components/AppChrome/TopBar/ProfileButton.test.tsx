import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { ProfileButton } from './ProfileButton';

// Mock the news feed to avoid real network requests that can cause flaky
// moment.js deprecation warnings when parsing RSS pubDate values.
jest.mock('app/plugins/panel/news/feed', () => ({
  ...jest.requireActual('app/plugins/panel/news/feed'),
  loadFeed: jest.fn().mockResolvedValue({ items: [] }),
}));

describe('ProfileButton', () => {
  let mainView: HTMLDivElement;
  let user: ReturnType<typeof userEvent.setup>;
  const defaultProps = {
    profileNode: {
      id: 'profile',
      text: 'Test User',
      url: '/profile',
      children: [],
    },
    onToggleKioskMode: jest.fn(),
  };
  const originalNewsFeedEnabled = config.newsFeedEnabled;
  const originalDisableSignoutMenu = config.auth.disableSignoutMenu;

  beforeEach(() => {
    user = userEvent.setup();
    config.newsFeedEnabled = true;
    config.auth.disableSignoutMenu = false;

    // Drawer portals into .main-view
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    config.newsFeedEnabled = originalNewsFeedEnabled;
    config.auth.disableSignoutMenu = originalDisableSignoutMenu;
    document.body.removeChild(mainView);
  });

  it('should not render the sign out divider when the sign out menu is disabled', async () => {
    config.auth.disableSignoutMenu = true;

    render(<ProfileButton {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /profile/i }));

    const menu = await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: /sign out/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(Array.from(menu.children)).toHaveLength(4);
  });

  it('should return focus to the profile button when the news feed drawer is closed', async () => {
    render(<ProfileButton {...defaultProps} />);

    const profileButton = screen.getByRole('button', { name: /profile/i });

    // Open the dropdown menu and open the news drawer
    await user.click(profileButton);
    const newsMenuItem = await screen.findByRole('menuitem', { name: /latest from the blog/i });
    await user.click(newsMenuItem);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Close the drawer
    await user.click(screen.getByRole('button', { name: /close/i }));

    // Verify the drawer is closed and focus returned to the profile button
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(profileButton).toHaveFocus();
  });
});
