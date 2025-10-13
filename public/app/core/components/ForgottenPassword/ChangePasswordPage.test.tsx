import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

import { ChangePasswordPage, Props } from './ChangePasswordPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: postMock,
  }),
  locationService: {
    getSearch: () => new URLSearchParams(),
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    loginError: false,
    buildInfo: {
      version: 'v1.0',
      commit: '1',
      env: 'production',
      edition: 'Open Source',
    },
    licenseInfo: {
      stateInfo: '',
      licenseUrl: '',
    },
    appSubUrl: '',
    auth: {
      basicAuthStrongPasswordPolicy: false,
    },
  },
}));

const props: Props = {
  ...getRouteComponentProps({
    queryParams: { code: 'some code' },
  }),
};

describe('ChangePassword Page', () => {
  it('renders correctly', () => {
    render(<ChangePasswordPage {...props} />);

    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });
  it('should pass validation checks for password and confirm password field', async () => {
    render(<ChangePasswordPage {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('New Password is required')).toBeInTheDocument();
    expect(screen.getByText('Confirmed Password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('New password'), 'admin');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a');
    await waitFor(() => expect(screen.getByText('Passwords must match!')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Confirm new password'), 'dmin');
    await waitFor(() => expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument());
  });
  it('should navigate to default url if change password is successful', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
    });
    postMock.mockResolvedValueOnce({ message: 'Logged in' });
    render(<ChangePasswordPage {...props} />);

    await userEvent.type(screen.getByLabelText('New password'), 'test');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'test');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/user/password/reset', {
        code: 'some code',
        confirmPassword: 'test',
        newPassword: 'test',
      })
    );
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });
});
