import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { NavModel } from '@grafana/data';

import { CreateTeam, Props } from './CreateTeam';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockPost = jest.fn(() => {
  return Promise.resolve({});
});

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => {
    return {
      post: mockPost,
    };
  },
  config: {
    buildInfo: {},
    licenseInfo: {},
  },
}));

const setup = () => {
  const props: Props = {
    navModel: { node: {}, main: {} } as NavModel,
  };
  return render(<CreateTeam {...props} />);
};

describe('Create team', () => {
  it('should render component', () => {
    setup();
    expect(screen.getByText(/new team/i)).toBeInTheDocument();
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
