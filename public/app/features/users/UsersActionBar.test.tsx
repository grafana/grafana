import { render, screen } from '@testing-library/react';
import React from 'react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

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
});
