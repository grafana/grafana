import { render, screen } from 'test/test-utils';

import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';

import { NotebooksSidebarPanel } from './NotebooksSidebarPanel';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagDashboardNotebooks: jest.fn(),
}));
jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
}));
jest.mock('app/core/services/context_srv');
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: () => ({ pathname: '/' }),
}));

const useFlagDashboardNotebooksMock = jest.mocked(useFlagDashboardNotebooks);
const useListNotebookQueryMock = jest.mocked(useListNotebookQuery);
const contextSrvMock = jest.mocked(contextSrv);

describe('NotebooksSidebarPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFlagDashboardNotebooksMock.mockReturnValue(true);
    contextSrvMock.hasPermission.mockReturnValue(true);
    useListNotebookQueryMock.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: undefined,
    } as never);
  });

  it('does not render when notebooks are disabled', () => {
    useFlagDashboardNotebooksMock.mockReturnValue(false);

    const { container } = render(<NotebooksSidebarPanel />);

    expect(container.firstChild).toBeNull();
  });

  it('does not render without notebook write permissions', () => {
    contextSrvMock.hasPermission.mockReturnValue(false);

    const { container } = render(<NotebooksSidebarPanel />);

    expect(container.firstChild).toBeNull();
  });

  it('renders the empty state when the notebook list is empty', () => {
    render(<NotebooksSidebarPanel />);

    expect(screen.getByText('No notebooks yet — create one to start capturing findings.')).toBeInTheDocument();
  });

  it('renders an error instead of the empty state when listing fails', () => {
    useListNotebookQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500 },
    } as never);

    render(<NotebooksSidebarPanel />);

    expect(screen.getByText('Failed to load notebooks')).toBeInTheDocument();
    expect(screen.queryByText('No notebooks yet — create one to start capturing findings.')).not.toBeInTheDocument();
  });
});
