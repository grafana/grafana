import { render, fireEvent, screen, userEvent } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { VerifyEmailPage } from './VerifyEmailPage';

setBackendSrv(backendSrv);
setupMockServer();

describe('VerifyEmail Page', () => {
  it('renders correctly', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText('Verify email')).toBeInTheDocument();
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
    expect(await screen.findByText('Email is invalid')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
    expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument();
  });
  it('should show complete signup if email-verification is successful', async () => {
    const capture = captureRequests((r) => r.url.includes('/api/user/signup') && r.method === 'POST');
    render(<VerifyEmailPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /Email/i }), 'test@gmail.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }));

    expect(await screen.findByRole('link', { name: 'Complete signup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete signup' })).toHaveAttribute('href', '/signup');

    const [signupRequest] = await capture;
    expect(await signupRequest.clone().json()).toEqual({ email: 'test@gmail.com' });
  });
});
