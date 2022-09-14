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
const mockOnDismiss = jest.fn();
const mockPost = jest.fn();

const setup = async () => {
  const mockDashboard = new DashboardModel({
    uid: 'mockDashboardUid',
    version: 1,
  });
  const store = configureStore();

  const { rerender } = await waitFor(() =>
    render(
      <Provider store={store}>
        <SaveDashboardDrawer dashboard={mockDashboard} onDismiss={mockOnDismiss} />{' '}
      </Provider>
    )
  );

  return { rerender, mockDashboard, store };
};

describe('SaveDashboardDrawer', () => {
  beforeEach(() => {
    mockPost.mockClear();
  });

  it("renders SaveDashboardErrorProxy if there's an error and it not yet handled", async () => {
    jest.spyOn(console, 'error').mockImplementation();
    mockPost.mockRejectedValueOnce({
      status: 412,
      data: {
        status: 'plugin-dashboard',
      },
      config: {},
    });

    const { rerender, store, mockDashboard } = await setup();

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument();

    rerender(
      <Provider store={store}>
        <SaveDashboardDrawer dashboard={mockDashboard} onDismiss={mockOnDismiss} />{' '}
      </Provider>
    );

    mockPost.mockClear();
    mockPost.mockRejectedValueOnce({
      status: 412,
      data: {
        status: 'plugin-dashboard',
      },
      isHandled: true,
      config: {},
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText(/save dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
  });
});
