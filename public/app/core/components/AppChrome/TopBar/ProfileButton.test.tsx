import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

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
  const originalContextSrvUser = { ...contextSrv.user };
  const defaultProps = {
    profileNode: {
      id: 'profile',
      text: 'Test User',
      url: '/profile',
      children: [
        {
          id: 'profile/settings',
          text: 'Profile settings',
          url: '/profile',
        },
        {
          id: 'profile/password',
          text: 'Change password',
          url: '/profile/password',
        },
      ],
    },
    onToggleKioskMode: jest.fn(),
  };

  beforeEach(() => {
    user = userEvent.setup();
    config.newsFeedEnabled = true;

    // Drawer portals into .main-view
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    document.body.removeChild(mainView);
    contextSrv.user = { ...originalContextSrvUser };
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

  it('should hide change password entry for external users', async () => {
    contextSrv.user = { ...contextSrv.user, authenticatedBy: 'oauth_google' };
    render(<ProfileButton {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /profile/i }));

    expect(screen.queryByRole('menuitem', { name: /change password/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /profile settings/i })).toBeInTheDocument();
  });
});
