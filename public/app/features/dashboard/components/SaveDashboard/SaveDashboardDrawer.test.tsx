import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { DashboardModel } from '../../state';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

jest.mock('app/core/core', () => ({
  ...jest.requireActual('app/core/core'),
  contextSrv: {},
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    post: mockPost,
  }),
}));

jest.mock('app/core/services/backend_srv', () => ({
  backendSrv: {
    getDashboardByUid: jest.fn().mockResolvedValue({ dashboard: {} }),
  },
}));

const store = configureStore();
const mockPost = jest.fn();
const buildMocks = () => ({
  dashboard: new DashboardModel({
    uid: 'mockDashboardUid',
    version: 1,
  }),
  error: {
    status: 412,
    data: {
      status: 'plugin-dashboard',
    },
    config: {},
  },
  onDismiss: jest.fn(),
});

interface CompProps {
  dashboard: DashboardModel;
  onDismiss: () => void;
}
const CompWithProvider = (props: CompProps) => (
  <Provider store={store}>
    <SaveDashboardDrawer {...props} />
  </Provider>
);

const setup = (options: CompProps) => waitFor(() => render(<CompWithProvider {...options} />));

describe('SaveDashboardDrawer', () => {
  beforeEach(() => {
    mockPost.mockClear();
    jest.spyOn(console, 'error').mockImplementation();
  });

  it("renders a modal if there's an unhandled error", async () => {
    const { onDismiss, dashboard, error } = buildMocks();
    mockPost.mockRejectedValueOnce(error);

    await setup({ dashboard, onDismiss });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument();
  });

  it('should render corresponding save modal once the errror is handled', async () => {
    const { onDismiss, dashboard, error } = buildMocks();
    mockPost.mockRejectedValueOnce(error);

    const { rerender } = await setup({ dashboard, onDismiss });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    rerender(<CompWithProvider dashboard={dashboard} onDismiss={onDismiss} />);

    mockPost.mockClear();
    mockPost.mockRejectedValueOnce({ ...error, isHandled: true });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText(/save dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
  });
});
