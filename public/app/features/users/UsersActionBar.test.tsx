import { render, screen } from '@testing-library/react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { config } from 'app/core/config';

import { Props, UsersActionBarUnconnected } from './UsersActionBar';
import { searchQueryChanged } from './state/reducers';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    changeSearchQuery: mockToolkitActionCreator(searchQueryChanged),
    onShowInvites: jest.fn(),
    pendingInvitesCount: 0,
    externalUserMngLinkUrl: '',
    externalUserMngLinkName: '',
    externalUserMngAnalytics: false,
    externalUserMngAnalyticsParams: '',
    showInvites: false,
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(<UsersActionBarUnconnected {...props} />);

  return { rerender, props };
};

describe('Render', () => {
  it('should render component', () => {
    setup();

    expect(screen.getByTestId('users-action-bar')).toBeInTheDocument();
  });

  it('should render pending invites button', () => {
    setup({
      pendingInvitesCount: 5,
    });

    expect(screen.getByRole('radio', { name: 'Pending Invites (5)' })).toBeInTheDocument();
  });

  it('should show invite button', () => {
    setup();

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
  });

  it('should show external user management button', () => {
    setup({
      externalUserMngLinkUrl: 'http://some/url',
      externalUserMngLinkName: 'someUrl',
    });

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute('href', 'http://some/url');
  });

  it('should show external user management button with analytics values when configured', () => {
    setup({
      externalUserMngLinkUrl: 'http://some/url',
      externalUserMngLinkName: 'someUrl',
      externalUserMngAnalytics: true,
      externalUserMngAnalyticsParams: 'src=grafananet&other=value1',
    });

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute(
      'href',
      'http://some/url?src=grafananet&other=value1&cnt=manage-users'
    );
  });

  it('should show external user management button without analytics values when disabled', () => {
    setup({
      externalUserMngLinkUrl: 'http://some/url',
      externalUserMngLinkName: 'someUrl',
      externalUserMngAnalytics: false,
      externalUserMngAnalyticsParams: 'src=grafananet&other=value1',
    });

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute('href', 'http://some/url');
  });

  it('should not show invite button when externalUserMngInfo is set and disableLoginForm is true', () => {
    const originalExternalUserMngInfo = config.externalUserMngInfo;
    config.externalUserMngInfo = 'truthy';
    config.disableLoginForm = true;

    setup();

    expect(screen.queryByRole('link', { name: 'Invite' })).not.toBeInTheDocument();
    // Reset the disableLoginForm mock to its original value
    config.externalUserMngInfo = originalExternalUserMngInfo;
  });

  it('should show invite button when externalUserMngInfo is not set and disableLoginForm is true', () => {
    config.externalUserMngInfo = '';
    config.disableLoginForm = true;

    setup();

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
    // Reset the disableLoginForm mock to its original value
    config.disableLoginForm = false;
  });

  it('should show invite button when externalUserMngInfo is set and disableLoginForm is false', () => {
    const originalExternalUserMngInfo = config.externalUserMngInfo;
    config.externalUserMngInfo = 'truthy';

    setup();

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
    // Reset the disableLoginForm mock to its original value
    config.externalUserMngInfo = originalExternalUserMngInfo;
  });
});
