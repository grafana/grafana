import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { render } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { customLoginHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import LoginPage from './LoginPage';

setBackendSrv(backendSrv);
setupMockServer();

const originalOauth = config.oauth;
const originalLoginError = config.loginError;

const mockLocationAssign = jest.fn();
const originalLocation = window.location;

beforeAll(() => {
  jest.spyOn(window, 'location', 'get').mockReturnValue({ ...originalLocation, assign: mockLocationAssign });
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  mockLocationAssign.mockClear();
  config.oauth = originalOauth;
  config.loginError = originalLoginError;
});

describe('Login Page', () => {
  it('renders correctly', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Welcome to Grafana' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email or username' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/user/password/send-reset-email'
    );

    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it('should pass validation checks for username field', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or username is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Email or username' }), 'admin');
    await waitFor(() => expect(screen.queryByText('Email or username is required')).not.toBeInTheDocument());
  });

  it('should pass validation checks for password field', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Password'), 'admin');
    await waitFor(() => expect(screen.queryByText('Password is required')).not.toBeInTheDocument());
  });

  it('should navigate to default url if credentials is valid', async () => {
    const capture = captureRequests((r) => r.url.includes('/login') && r.method === 'POST');
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email or username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'test');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith('/'));

    const [loginRequest] = await capture;
    expect(await loginRequest.clone().json()).toEqual({ user: 'admin', password: 'test' });
  });

  it('renders social logins correctly', () => {
    config.oauth = {
      okta: {
        name: 'Okta Test',
        icon: 'signin',
      },
    };

    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Sign in with Okta Test' })).toBeInTheDocument();
  });

  it('shows oauth errors', async () => {
    config.loginError = 'Oh no there was an error :(';

    render(<LoginPage />);

    const alert = await screen.findByRole('alert', { name: 'Login failed' });
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Oh no there was an error :(');
  });

  it('shows an error with incorrect password', async () => {
    server.use(
      customLoginHandler(() =>
        HttpResponse.json(
          { message: 'Invalid username or password', messageId: 'password-auth.failed' },
          { status: 400 }
        )
      )
    );

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email or username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'test');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    const alert = await screen.findByRole('alert', { name: 'Login failed' });
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Invalid username or password');
  });

  it('shows a different error with failed login attempts', async () => {
    server.use(
      customLoginHandler(() =>
        HttpResponse.json(
          { message: 'Invalid username or password', messageId: 'login-attempt.blocked' },
          { status: 401 }
        )
      )
    );

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email or username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'test');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    const alert = await screen.findByRole('alert', { name: 'Login failed' });
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      'You have exceeded the number of login attempts for this user. Please try again later.'
    );
  });
});
