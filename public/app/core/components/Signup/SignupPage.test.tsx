import { render, fireEvent, screen, waitFor, userEvent } from 'test/test-utils';

import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';

import { SignupPage } from './SignupPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: postMock,
  }),
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
    autoAssignOrg: false,
    verifyEmailEnabled: true,
  },
}));

const props = {
  email: '',
  code: '',
  ...getRouteComponentProps(),
};

describe('Signup Page', () => {
  it('renders correctly', () => {
    render(<SignupPage {...props} />);
    expect(screen.getByRole('heading', { name: 'Welcome to Grafana' })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Org. name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Email verification code/i })).toBeInTheDocument();

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
  });
  it('should pass validation checks for email field', async () => {
    render(<SignupPage {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
  });
  it('should pass validation checks for password and confirm password field', async () => {
    render(<SignupPage {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(await screen.findByText('Confirmed password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Password'), 'admin');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a');
    await waitFor(() => expect(screen.queryByText('Passwords must match!')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Confirm password'), 'dmin');
    await waitFor(() => expect(screen.queryByText('Passwords must match!')).not.toBeInTheDocument());
  });
  it('should navigate to default url if signup is successful', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
    });
    postMock.mockResolvedValueOnce({ message: 'Logged in' });
    render(<SignupPage {...props} />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'test-user');
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
    await userEvent.type(screen.getByLabelText('Password'), 'admin');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/user/signup/step2', {
        code: '',
        email: 'test@gmail.com',
        name: 'test-user',
        orgName: '',
        password: 'admin',
        username: 'test@gmail.com',
      })
    );
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });
});
