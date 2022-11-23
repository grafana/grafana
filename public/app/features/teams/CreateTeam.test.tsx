import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { BackendSrv, setBackendSrv } from '@grafana/runtime';

import { configureStore } from '../../store/configureStore';

import { CreateTeam } from './CreateTeam';

beforeEach(() => {
  jest.clearAllMocks();
});

jest.mock('app/core/core', () => ({
  contextSrv: {
    licensedAccessControlEnabled: () => false,
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
    user: { orgId: 1 },
  },
}));

jest.mock('app/core/components/RolePicker/hooks', () => ({
  useRoleOptions: jest.fn().mockReturnValue([{ roleOptions: [] }, jest.fn()]),
}));

const mockPost = jest.fn(() => {
  return Promise.resolve({});
});

setBackendSrv({
  post: mockPost,
} as unknown as BackendSrv);

const setup = () => {
  const store = configureStore();
  return render(
    <Provider store={store}>
      <CreateTeam />
    </Provider>
  );
};

describe('Create team', () => {
  it('should render component', () => {
    setup();
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should send correct data to the server', async () => {
    setup();
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Test team');
    await userEvent.type(screen.getByLabelText(/email/i), 'team@test.com');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(expect.anything(), { name: 'Test team', email: 'team@test.com' });
    });
  });

  it('should validate required fields', async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/email/i), 'team@test.com');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => {
      expect(mockPost).not.toBeCalled();
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText(/team name is required/i)).toBeInTheDocument();
  });
});
