import { render, fireEvent, screen, waitFor, userEvent } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { SignupPage } from './SignupPage';

setBackendSrv(backendSrv);
setupMockServer();

const originalVerifyEmailEnabled = config.verifyEmailEnabled;
const originalAutoAssignOrg = config.autoAssignOrg;

const mockLocationAssign = jest.fn();
const originalLocation = window.location;

beforeAll(() => {
  config.verifyEmailEnabled = true;
  config.autoAssignOrg = false;
  jest.spyOn(window, 'location', 'get').mockReturnValue({ ...originalLocation, assign: mockLocationAssign });
});

afterAll(() => {
  config.verifyEmailEnabled = originalVerifyEmailEnabled;
  config.autoAssignOrg = originalAutoAssignOrg;
  jest.restoreAllMocks();
});

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
    const capture = captureRequests((r) => r.url.includes('/api/user/signup/step2') && r.method === 'POST');
    render(<SignupPage {...props} />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'test-user');
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'test@gmail.com');
    await userEvent.type(screen.getByLabelText('Password'), 'admin');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'admin');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith('/'));

    const [signupRequest] = await capture;
    expect(await signupRequest.clone().json()).toEqual({
      code: '',
      email: 'test@gmail.com',
      name: 'test-user',
      orgName: '',
      password: 'admin',
      username: 'test@gmail.com',
    });
  });
});
