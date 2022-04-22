import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/redux-rtl';

import { VerifyEmailPage } from './VerifyEmailPage';

const postMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
    verifyEmailEnabled: true,
    appSubUrl: '',
  },
}));

describe('VerifyEmail Page', () => {
  it('renders correctly', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText('Verify Email')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Email/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');
  });
  it('should pass validation checks for email field', async () => {
    render(<VerifyEmailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).toBeInTheDocument());

    await userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
  });
  it('should show complete signup if email-verification is successful', async () => {
    postMock.mockResolvedValueOnce({ message: 'SignUpCreated' });
    render(<VerifyEmailPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/user/signup', {
        email: 'test@gmail.com',
      })
    );
    expect(screen.getByRole('link', { name: 'Complete Signup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete Signup' })).toHaveAttribute('href', '/signup');
  });
});
