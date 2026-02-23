import { render, screen } from '@testing-library/react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { config } from '@grafana/runtime';

import { Props, UsersActionBarUnconnected } from './UsersActionBar';
import { searchQueryChanged } from './state/reducers';

jest.mock('app/core/services/context_srv', () => ({
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
    showInvites: false,
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(<UsersActionBarUnconnected {...props} />);

  return { rerender, props };
};

describe('Render', () => {
  const originalExternalUserMngInfo = config.externalUserMngInfo;
  const originalExternalUserMngLinkUrl = config.externalUserMngLinkUrl;
  const originalExternalUserMngLinkName = config.externalUserMngLinkName;
  const originalExternalUserMngAnalytics = config.externalUserMngAnalytics;
  const originalExternalUserMngAnalyticsParams = config.externalUserMngAnalyticsParams;
  const originalDisableLoginForm = config.disableLoginForm;

  afterEach(() => {
    // Restore original config after each test
    config.externalUserMngInfo = originalExternalUserMngInfo;
    config.externalUserMngLinkUrl = originalExternalUserMngLinkUrl;
    config.externalUserMngLinkName = originalExternalUserMngLinkName;
    config.externalUserMngAnalytics = originalExternalUserMngAnalytics;
    config.externalUserMngAnalyticsParams = originalExternalUserMngAnalyticsParams;
    config.disableLoginForm = originalDisableLoginForm;
  });

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
    config.externalUserMngLinkUrl = 'http://some/url';
    config.externalUserMngLinkName = 'someUrl';

    setup();

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute('href', 'http://some/url');
  });

  it('should show external user management button with analytics values when configured', () => {
    config.externalUserMngAnalytics = true;
    config.externalUserMngAnalyticsParams = 'src=grafananet&other=value1';
    config.externalUserMngLinkUrl = 'http://some/url';
    config.externalUserMngLinkName = 'someUrl';

    setup();

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute(
      'href',
      'http://some/url?src=grafananet&other=value1&cnt=manage-users'
    );
  });

  it('should show external user management button without analytics values when disabled', () => {
    config.externalUserMngAnalytics = false;
    config.externalUserMngAnalyticsParams = 'src=grafananet&other=value1';
    config.externalUserMngLinkUrl = 'http://some/url';
    config.externalUserMngLinkName = 'someUrl';

    setup();

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute('href', 'http://some/url');
  });

  it('should not show invite button when externalUserMngInfo is set and disableLoginForm is true', () => {
    config.externalUserMngInfo = 'truthy';
    config.disableLoginForm = true;

    setup();

    expect(screen.queryByRole('link', { name: 'Invite' })).not.toBeInTheDocument();
  });

  it('should show invite button when externalUserMngInfo is not set and disableLoginForm is true', () => {
    config.externalUserMngInfo = '';
    config.disableLoginForm = true;

    setup();

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
  });

  it('should show invite button when externalUserMngInfo is set and disableLoginForm is false', () => {
    config.externalUserMngInfo = 'truthy';

    setup();

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
  });
});
