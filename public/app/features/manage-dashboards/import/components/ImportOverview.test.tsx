import { render, screen, act } from 'test/test-utils';

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
  isMissingRepo: false,
};

// Track which folderName the hook is called with so tests can configure per-folder responses.
let repoViewByFolder: Record<string, Partial<ReturnType<typeof useGetResourceRepositoryView>>> = {};

jest.mock('app/features/provisioning/hooks/useGetResourceRepositoryView', () => ({
  RepoViewStatus: {
    Disabled: 'disabled',
    Loading: 'loading',
    Ready: 'ready',
    Error: 'error',
    Orphaned: 'orphaned',
  },
  useGetResourceRepositoryView: jest.fn((args: { folderName?: string }) => {
    const perFolder = args.folderName ? repoViewByFolder[args.folderName] : undefined;
    const view = perFolder ? { ...mockRepoView, ...perFolder } : { ...mockRepoView };
    // Derive isMissingRepo the same way the real hook does, so the mock can
    // never produce impossible states like a defined repository with isMissingRepo=true.
    return { ...view, isMissingRepo: !view.isLoading && !view.repository };
  }),
}));

// Capture onFolderChange from overview mocks so tests can simulate a folder change.
let capturedOnFolderChange: ((uid: string) => void) | undefined;

jest.mock('./ImportOverviewV1', () => ({
  ImportOverviewV1: (props: { onFolderChange?: (uid: string) => void }) => {
    capturedOnFolderChange = props.onFolderChange;
    return <div data-testid="standard-v1">Standard V1</div>;
  },
}));

jest.mock('./ImportOverviewV2', () => ({
  ImportOverviewV2: (props: { onFolderChange?: (uid: string) => void }) => {
    capturedOnFolderChange = props.onFolderChange;
    return <div data-testid="standard-v2">Standard V2</div>;
  },
}));

jest.mock('app/features/provisioning/components/Dashboards/ProvisionedImportOverview', () => ({
  ProvisionedImportOverview: (props: { status: string; onFolderChange?: (uid: string) => void }) => {
    capturedOnFolderChange = props.onFolderChange;
    return (
      <div data-testid="provisioned-import" data-status={props.status}>
        Provisioned Import
      </div>
    );
  },
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
    repoViewByFolder = {};
    capturedOnFolderChange = undefined;
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

    it('renders error alert for unknown dashboard type', () => {
      setRepoView({ status: RepoViewStatus.Disabled });
      render(<ImportOverview {...defaultProps} dashboard={{ unknown: true }} />);
      expect(screen.getByRole('alert', { name: /invalid or unknown dashboard schema/i })).toBeInTheDocument();
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

  describe('folder change triggers provisioning switch', () => {
    it('switches V1 to provisioned import when user selects a provisioned folder', () => {
      // Start with no provisioning (root browse)
      jest.spyOn(locationService, 'getSearchObject').mockReturnValue({});
      setRepoView({ status: RepoViewStatus.Disabled });

      // Configure per-folder: 'provisioned-folder' is repo-managed
      repoViewByFolder['provisioned-folder'] = { status: RepoViewStatus.Ready, repository };

      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();

      // Simulate folder change from the standard form
      act(() => {
        capturedOnFolderChange?.('provisioned-folder');
      });

      expect(screen.getByTestId('provisioned-import')).toBeInTheDocument();
      expect(screen.queryByTestId('standard-v1')).not.toBeInTheDocument();
    });

    it('switches V2 to provisioned import when user selects a provisioned folder', () => {
      jest.spyOn(locationService, 'getSearchObject').mockReturnValue({});
      setRepoView({ status: RepoViewStatus.Disabled });
      repoViewByFolder['provisioned-folder'] = { status: RepoViewStatus.Ready, repository };

      render(<ImportOverview {...defaultProps} dashboard={v2Dashboard} />);
      expect(screen.getByTestId('standard-v2')).toBeInTheDocument();

      act(() => {
        capturedOnFolderChange?.('provisioned-folder');
      });

      expect(screen.getByTestId('provisioned-import')).toBeInTheDocument();
      expect(screen.queryByTestId('standard-v2')).not.toBeInTheDocument();
    });

    it('switches from provisioned import to standard import when user selects a non-provisioned folder', () => {
      setRepoView({ status: RepoViewStatus.Ready, repository });
      repoViewByFolder['regular-folder'] = { status: RepoViewStatus.Ready, repository: undefined };

      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('provisioned-import')).toBeInTheDocument();

      act(() => {
        capturedOnFolderChange?.('regular-folder');
      });

      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-import')).not.toBeInTheDocument();
    });

    it('stays on standard import when user selects a non-provisioned folder', () => {
      jest.spyOn(locationService, 'getSearchObject').mockReturnValue({});
      setRepoView({ status: RepoViewStatus.Disabled });

      // Both folders are non-provisioned
      repoViewByFolder['regular-folder'] = { status: RepoViewStatus.Ready, repository: undefined };

      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();

      act(() => {
        capturedOnFolderChange?.('regular-folder');
      });

      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();
      expect(screen.queryByTestId('provisioned-import')).not.toBeInTheDocument();
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

  describe('error / orphaned states (fail-closed)', () => {
    it('routes to ProvisionedImportOverview with Error status — blocks standard import', () => {
      setRepoView({ status: RepoViewStatus.Error, error: new Error('fail') });
      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      const el = screen.getByTestId('provisioned-import');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-status', 'error');
      expect(screen.queryByTestId('standard-v1')).not.toBeInTheDocument();
    });

    it('routes to ProvisionedImportOverview with Orphaned status — blocks standard import', () => {
      setRepoView({ status: RepoViewStatus.Orphaned });
      render(<ImportOverview {...defaultProps} dashboard={v2Dashboard} />);
      const el = screen.getByTestId('provisioned-import');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-status', 'orphaned');
      expect(screen.queryByTestId('standard-v2')).not.toBeInTheDocument();
    });

    it('routes to ProvisionedImportOverview when folder change results in Error status', () => {
      jest.spyOn(locationService, 'getSearchObject').mockReturnValue({});
      setRepoView({ status: RepoViewStatus.Disabled });
      repoViewByFolder['broken-folder'] = { status: RepoViewStatus.Error, error: new Error('lookup failed') };

      render(<ImportOverview {...defaultProps} dashboard={v1Dashboard} />);
      expect(screen.getByTestId('standard-v1')).toBeInTheDocument();

      act(() => {
        capturedOnFolderChange?.('broken-folder');
      });

      const el = screen.getByTestId('provisioned-import');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('data-status', 'error');
      expect(screen.queryByTestId('standard-v1')).not.toBeInTheDocument();
    });
  });
});
