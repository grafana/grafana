import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: postMock,
  }),
}));

jest.mock('app/core/config', () => {
  return {
    loginError: false,
    buildInfo: {
      version: 'v1.0',
      commit: '1',
      env: 'production',
      edition: 'Open Source',
      isEnterprise: false,
    },
    licenseInfo: {
      stateInfo: '',
      licenseUrl: '',
    },
    appSubUrl: '',
    getConfig: () => ({
      appSubUrl: '',
      verifyEmailEnabled: false,
    }),
  };
});

describe('Login Page', () => {
  it('renders correctly', () => {
    const { container } = render(<LoginPage />);
    expect(container).toMatchSnapshot();
  });
  it('should pass validation checks for username field', async () => {
    render(<LoginPage />);
    // when
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Login button'));
    });
    // then
    expect(screen.queryByText('Email or username is required')).toBeInTheDocument();
    // when
    await act(async () => {
      userEvent.type(screen.getByLabelText('Username input field'), 'admin');
    });
    // then
    expect(screen.queryByText('Email or username is required')).not.toBeInTheDocument();
  });
  it('should pass validation checks for password field', async () => {
    render(<LoginPage />);
    // when
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Login button'));
    });
    // then
    expect(screen.queryByText('Password is required')).toBeInTheDocument();
    // when
    await act(async () => {
      userEvent.type(screen.getByLabelText('Password input field'), 'admin');
    });
    // then
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
  });
  it('should navigate to default url if credentials is valid', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
    });
    postMock.mockResolvedValueOnce({ message: 'Logged in' });
    render(<LoginPage />);
    // when
    await act(async () => {
      userEvent.type(screen.getByLabelText('Username input field'), 'admin');
      userEvent.type(screen.getByLabelText('Password input field'), 'test');
      fireEvent.click(screen.getByLabelText('Login button'));
    });
    // then
    expect(postMock).toHaveBeenCalledWith('/login', { password: 'test', user: 'admin' });
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });
});
