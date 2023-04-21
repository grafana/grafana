import { render, screen } from '@testing-library/react';
import React from 'react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { config } from 'app/core/config';

import { Props, UsersActionBarUnconnected } from './UsersActionBar';
import { searchQueryChanged } from './state/reducers';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    hasAccess: () => true,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    changeSearchQuery: mockToolkitActionCreator(searchQueryChanged),
    onShowInvites: jest.fn(),
    pendingInvitesCount: 0,
    canInvite: false,
    externalUserMngLinkUrl: '',
    externalUserMngLinkName: '',
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
    setup({
      canInvite: true,
    });

    expect(screen.getByRole('link', { name: 'Invite' })).toHaveAttribute('href', 'org/users/invite');
  });

  it('should show external user management button', () => {
    setup({
      externalUserMngLinkUrl: 'some/url',
      externalUserMngLinkName: 'someUrl',
    });

    expect(screen.getByRole('link', { name: 'someUrl' })).toHaveAttribute('href', 'some/url');
  });

  it('should not show invite button when disableLoginForm is set', () => {
    const originalDisableLoginForm = config.disableLoginForm;
    config.disableLoginForm = true;

    setup({
      canInvite: true,
    });

    expect(screen.queryByRole('link', { name: 'Invite' })).not.toBeInTheDocument();
    // Reset the disableLoginForm mock to its original value
    config.disableLoginForm = originalDisableLoginForm;
  });
});
