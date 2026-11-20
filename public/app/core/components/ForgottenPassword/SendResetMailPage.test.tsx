import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { SendResetMailPage } from './SendResetMailPage';

setBackendSrv(backendSrv);
setupMockServer();

describe('SendResetMail Page', () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Send reset email' }));
    expect(await screen.findByText('Email or username is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
    await waitFor(() => expect(screen.queryByText('Email is invalid')).not.toBeInTheDocument());
  });
  it('should show success message if reset-password is successful', async () => {
    const capture = captureRequests(
      (r) => r.url.includes('/api/user/password/send-reset-email') && r.method === 'POST'
    );
    render(<SendResetMailPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /User Enter your information/i }), 'test@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset email' }));

    expect(await screen.findByText(/An email with a reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to login' })).toHaveAttribute('href', '/login');

    const [resetRequest] = await capture;
    expect(await resetRequest.clone().json()).toEqual({ userOrEmail: 'test@gmail.com' });
  });
});
