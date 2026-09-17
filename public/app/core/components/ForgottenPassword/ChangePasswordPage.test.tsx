import { render, fireEvent, screen, waitFor, userEvent } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { ChangePasswordPage, type Props } from './ChangePasswordPage';

setBackendSrv(backendSrv);
setupMockServer();

const props: Props = {
  ...getRouteComponentProps({
    queryParams: { code: 'some code' },
  }),
};

const mockLocationAssign = jest.fn();
const originalLocation = window.location;

beforeAll(() => {
  jest.spyOn(window, 'location', 'get').mockReturnValue({ ...originalLocation, assign: mockLocationAssign });
});

afterAll(() => {
  jest.restoreAllMocks();
});

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
    const capture = captureRequests((r) => r.url.includes('/api/user/password/reset') && r.method === 'POST');
    render(<ChangePasswordPage {...props} />);

    await userEvent.type(screen.getByLabelText('New password'), 'test');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'test');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith('/'));

    const [resetRequest] = await capture;
    expect(await resetRequest.clone().json()).toEqual({
      code: 'some code',
      confirmPassword: 'test',
      newPassword: 'test',
    });
  });
});
