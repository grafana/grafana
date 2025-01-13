import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { DashboardModel } from '../../state/DashboardModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';

const saveDashboardMutationMock = jest.fn();

jest.mock('app/core/core', () => ({
  ...jest.requireActual('app/core/core'),
  contextSrv: {},
}));

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useSaveDashboardMutation: () => [saveDashboardMutationMock],
}));

const store = configureStore();
const buildMocks = () => ({
  dashboard: createDashboardModelFixture({
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
    saveDashboardMutationMock.mockClear();
    jest.spyOn(console, 'error').mockImplementation();
  });

  it("renders a modal if there's an unhandled error", async () => {
    const { onDismiss, dashboard, error } = buildMocks();
    saveDashboardMutationMock.mockResolvedValue({
      error,
    });

    await setup({ dashboard, onDismiss });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument();
  });

  it('should render corresponding save modal once the error is handled', async () => {
    const { onDismiss, dashboard, error } = buildMocks();
    saveDashboardMutationMock.mockResolvedValue({
      error,
    });

    const { rerender } = await setup({ dashboard, onDismiss });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    rerender(<CompWithProvider dashboard={dashboard} onDismiss={onDismiss} />);

    saveDashboardMutationMock.mockClear();
    saveDashboardMutationMock.mockResolvedValue({
      error,
      isHandled: true,
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText(/save dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
  });
});
