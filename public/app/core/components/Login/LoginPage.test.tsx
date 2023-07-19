import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import * as runtimeMock from '@grafana/runtime';

import { LoginPage } from './LoginPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  __esModule: true,
  getBackendSrv: () => ({
    post: postMock,
  }),
  config: {
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
    verifyEmailEnabled: false,
  },
}));

describe('Login Page', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders correctly', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Welcome to Grafana' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Username input field' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password input field')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login button' })).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: 'Login button' }));
    expect(await screen.findByText('Email or username is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Username input field' }), 'admin');
    await waitFor(() => expect(screen.queryByText('Email or username is required')).not.toBeInTheDocument());
  });

  it('should pass validation checks for password field', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Login button' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Password input field'), 'admin');
    await waitFor(() => expect(screen.queryByText('Password is required')).not.toBeInTheDocument());
  });

  it('should navigate to default url if credentials is valid', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
    });
    postMock.mockResolvedValueOnce({ message: 'Logged in' });
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Username input field'), 'admin');
    await userEvent.type(screen.getByLabelText('Password input field'), 'test');
    fireEvent.click(screen.getByLabelText('Login button'));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/login', { password: 'test', user: 'admin' }, { showErrorAlert: false })
    );
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });

  it('renders social logins correctly', () => {
    runtimeMock.config.oauth = {
      okta: {
        name: 'Okta Test',
        icon: 'signin',
      },
    };

    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Sign in with Okta Test' })).toBeInTheDocument();
  });

  it('shows an error with incorrect password', async () => {
    postMock.mockRejectedValueOnce({
      data: {
        message: 'Invalid username or password',
        messageId: 'password-auth.failed',
        statusCode: 400,
      },
      status: 400,
      statusText: 'Bad Request',
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Username input field'), 'admin');
    await userEvent.type(screen.getByLabelText('Password input field'), 'test');
    await userEvent.click(screen.getByRole('button', { name: 'Login button' }));

    expect(await screen.findByRole('alert', { name: 'Invalid username or password' })).toBeInTheDocument();
  });

  it('shows a different error with failed login attempts', async () => {
    postMock.mockRejectedValueOnce({
      data: {
        message: 'Invalid username or password',
        messageId: 'login-attempt.blocked',
        statusCode: 401,
      },
      status: 401,
      statusText: 'Unauthorized',
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Username input field'), 'admin');
    await userEvent.type(screen.getByLabelText('Password input field'), 'test');
    await userEvent.click(screen.getByRole('button', { name: 'Login button' }));

    expect(
      await screen.findByRole('alert', {
        name: 'You have exceeded the number of login attempts for this user. Please try again later.',
      })
    ).toBeInTheDocument();
  });
});
