import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SendResetMailPage } from './SendResetMailPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: postMock,
  }),
  config: {
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
  },
}));

describe('VerifyEmail Page', () => {
  it('renders correctly', () => {
    render(<SendResetMailPage />);
    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /User Enter your information/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Send reset email' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
  });
  it('should pass validation checks for email field', async () => {
    render(<SendResetMailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    expect(await screen.findByText('Email or username is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
  });
  it('should show success meessage if reset-password is successful', async () => {
    postMock.mockResolvedValueOnce({ message: 'Email sent' });
    render(<SendResetMailPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/user/password/send-reset-email', {
        userOrEmail: 'test@gmail.com',
      })
    );
    expect(screen.getByText(/An email with a reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
  });
});
