import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import config from 'app/core/config';
import { Props, ChangePasswordPage } from './ChangePasswordPage';
import { initialUserState } from './state/reducers';
import { getNavModel } from '../../core/selectors/navModel';
import { backendSrv } from '../../core/services/backend_srv';

const defaultProps: Props = {
  ...initialUserState,
  user: {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    login: 'test',
    isDisabled: false,
    isGrafanaAdmin: false,
    orgId: 0,
    authLabels: ['github'],
  },
  navModel: getNavModel(
    {
      'profile-settings': {
        icon: 'sliders-v-alt',
        id: 'profile-settings',
        parentItem: {
          id: 'profile',
          text: 'Test User',
          img: '/avatar/46d229b033af06a191ff2267bca9ae56',
          url: '/profile',
        },
        text: 'Preferences',
        url: '/profile',
      },
    },
    'profile-settings'
  ),
  loadUser: jest.fn(),
  changePassword: jest.fn(),
};

async function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();
  jest.spyOn(backendSrv, 'get').mockResolvedValue({
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    login: 'test',
    isDisabled: false,
    isGrafanaAdmin: false,
    orgId: 0,
  });

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(<ChangePasswordPage {...props} />);

  await waitFor(() => expect(props.loadUser).toHaveBeenCalledTimes(1));

  return { rerender, props };
}

describe('ChangePasswordPage', () => {
  it('should show loading placeholder', async () => {
    await getTestContext({ user: null });

    expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
  });

  it('should show change password form when user has loaded', async () => {
    await getTestContext();
    expect(screen.getByText('Change Your Password')).toBeInTheDocument();

    expect(screen.getByLabelText('Old password')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/profile');
  });
  it('should call changePassword if change password is valid', async () => {
    const { props } = await getTestContext();

    await userEvent.type(screen.getByLabelText('Old password'), 'test');
    await userEvent.type(screen.getByLabelText('New password'), 'admin');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    await waitFor(() => {
      expect(props.changePassword).toHaveBeenCalledTimes(1);
      expect(props.changePassword).toHaveBeenCalledWith(
        {
          confirmNew: 'admin',
          newPassword: 'admin',
          oldPassword: 'test',
        },
        expect.anything()
      );
    });
  });
  it('should cannot change password form if ldap or authProxy enabled', async () => {
    config.ldapEnabled = true;
    const { rerender } = await getTestContext();
    expect(
      screen.getByText('You cannot change password when LDAP or auth proxy authentication is enabled.')
    ).toBeInTheDocument();
    config.ldapEnabled = false;
    config.authProxyEnabled = true;
    rerender(<ChangePasswordPage {...defaultProps} />);
    expect(
      screen.getByText('You cannot change password when LDAP or auth proxy authentication is enabled.')
    ).toBeInTheDocument();
    config.authProxyEnabled = false;
  });
  it('should show cannot change password if disableLoginForm is true and auth', async () => {
    config.disableLoginForm = true;
    await getTestContext();
    expect(screen.getByText('Password cannot be changed here.')).toBeInTheDocument();
    config.disableLoginForm = false;
  });
});
