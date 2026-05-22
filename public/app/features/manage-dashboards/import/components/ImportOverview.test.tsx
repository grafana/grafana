import { render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { DashboardSource } from 'app/features/manage-dashboards/types';
import {
  RepoViewStatus,
  type useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { ImportOverview } from './ImportOverview';

// --- Mocks ---

const mockRepoView: ReturnType<typeof useGetResourceRepositoryView> = {
  status: RepoViewStatus.Disabled,
  isLoading: false,
  isInstanceManaged: false,
  isReadOnlyRepo: false,
};

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  RepoViewStatus: {
    Disabled: 'disabled',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
    Orphaned: 'orphaned',
  },
  useGetResourceRepositoryView: jest.fn(() => mockRepoView),
}));

jest.mock('./ImportOverviewV1', () => ({
  ImportOverviewV1: () => <div data-testid="standard-v1">Standard V1</div>,
}));

jest.mock('./ImportOverviewV2', () => ({
  ImportOverviewV2: () => <div data-testid="standard-v2">Standard V2</div>,
}));

jest.mock('app/features/provisioning/components/Dashboards/ProvisionedImportOverview', () => ({
  ProvisionedImportOverview: () => <div data-testid="provisioned-import">Provisioned Import</div>,
}));

const repository: RepositoryView = {
  name: 'test-repo',
  type: 'github',
  target: 'folder',
  title: 'Test Repository',
  branch: 'main',
  workflows: ['write', 'branch'],
};

const v1Dashboard: Dashboard = {
  title: 'V1 Dashboard',
  schemaVersion: 1,
  panels: [],
};

const v2Dashboard: DashboardV2Spec = {
  title: 'V2 Dashboard',
  description: '',
  cursorSync: 'Off',
  liveNow: false,
  preload: false,
  tags: [],
  timeSettings: {
    timezone: 'browser',
    from: 'now-6h',
    to: 'now',
    autoRefresh: '',
    autoRefreshIntervals: [],
    hideTimepicker: false,
    weekStart: undefined,
    fiscalYearStartMonth: 0,
    nowDelay: '',
    quickRanges: [],
  },
  links: [],
  annotations: [],
  variables: [],
  elements: {},
  layout: { kind: 'GridLayout', spec: { items: [] } },
};

const defaultProps = {
  dashboardUid: 'test-uid',
  inputs: { dataSources: [], constants: [], libraryPanels: [] },
  meta: { updatedAt: '2024-01-01', orgName: 'Test' },
  source: DashboardSource.Json,
  onCancel: jest.fn(),
};

function setRepoView(overrides: Partial<ReturnType<typeof useGetResourceRepositoryView>>) {
  Object.assign(mockRepoView, {
    status: RepoViewStatus.Disabled,
    repository: undefined,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    ...overrides,
  });
}

describe('ImportOverview dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(locationService, 'getSearchObject').mockReturnValue({ folderUid: 'folder-1' });
    setRepoView({ status: RepoViewStatus.Disabled });
  });

  describe('standard (non-provisioned) routing', () => {
    it('renders V1 overview for V1 dashboard when not provisioned', () => {
      setRepoView({ status: RepoViewStatus.Disabled });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-import')).not.toBeInTheDocument();
    });

    it('renders V2 overview for V2 dashboard when not provisioned', () => {
      setRepoView({ status: RepoViewStatus.Disabled });
      render(<ImportOverview {...defaultProps} dashboard={v2Dashboard} />);
      expect(screen.getByTestId('standard-v2')).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-import')).not.toBeInTheDocument();
    });

    it('renders nothing for unknown dashboard type', () => {
      setRepoView({ status: RepoViewStatus.Disabled });
      const { container } = render(<ImportOverview {...defaultProps} dashboard={{ unknown: true }} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders V1 overview when status is Ready but no repository', () => {
      setRepoView({ status: RepoViewStatus.Ready, repository: undefined });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();
    });
  });

  describe('provisioned routing', () => {
    it('renders ProvisionedImportOverview for V1 dashboard in provisioned folder', () => {
      setRepoView({ status: RepoViewStatus.Ready, repository });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('provisioned-import')).toBeInTheDocument();
      expect(screen.queryByTestId('standard-v1')).not.toBeInTheDocument();
    });

    it('renders ProvisionedImportOverview for V2 dashboard in provisioned folder', () => {
      setRepoView({ status: RepoViewStatus.Ready, repository });
      render(<ImportOverview {...defaultProps} dashboard={v2Dashboard} />);
      expect(screen.getByTestId('provisioned-import')).toBeInTheDocument();
      expect(screen.queryByTestId('standard-v2')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows spinner while detecting provisioning status', () => {
      setRepoView({ status: RepoViewStatus.Loading, isLoading: true });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('standard-v1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-import')).not.toBeInTheDocument();
    });
  });

  describe('error / orphaned fallthrough', () => {
    it('falls through to standard V1 when status is Error', () => {
      setRepoView({ status: RepoViewStatus.Error, error: new Error('fail') });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();
    });

    it('falls through to standard V2 when status is Orphaned', () => {
      setRepoView({ status: RepoViewStatus.Orphaned });
      render(<ImportOverview {...defaultProps} dashboard={v2Dashboard} />);
      expect(screen.getByTestId('standard-v2')).toBeInTheDocument();
    });
  });
});
