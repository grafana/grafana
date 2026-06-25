import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import HomePage from './HomePage';

// Stub the per-tab content so the test stays focused on the tab wiring. The
// Migrate tab is intentionally NOT mocked — we assert its real placeholder
// renders when the tab is active.
jest.mock('./Shared/RepositoryList', () => ({
  RepositoryList: () => <div>repositories-content</div>,
}));
jest.mock('./GettingStarted/GettingStarted', () => ({
  __esModule: true,
  default: () => <div>getting-started-content</div>,
}));
jest.mock('./Connection/ConnectionsTabContent', () => ({
  ConnectionsTabContent: () => <div>connections-content</div>,
}));
jest.mock('./Shared/ConnectRepositoryButton', () => ({
  ConnectRepositoryButton: () => <div>connect-repository-button</div>,
}));

jest.mock('./hooks/useRepositoryList', () => ({
  useRepositoryList: jest.fn(() => [[], false]),
}));
jest.mock('./hooks/useConnectionList', () => ({
  useConnectionList: jest.fn(() => [[], false, undefined, jest.fn()]),
}));
jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useDeletecollectionRepositoryMutation: jest.fn(() => [jest.fn(), {}]),
  // The Migrate tab renders for real (see note above) and queries resource
  // stats; return an empty result so it falls through to its empty state.
  useGetResourceStatsQuery: jest.fn(() => ({
    data: { instance: [], managed: [] },
    isLoading: false,
    isError: false,
    error: undefined,
  })),
  // Migrate reads availableResources to gate optional kinds (e.g. playlists);
  // no settings means those kinds stay off here.
  useGetFrontendSettingsQuery: jest.fn(() => ({ data: undefined })),
}));
// The Migrate tab also enumerates resources from the unified searcher; return
// an already-resolved empty list so its render is synchronous here.
jest.mock('./Migrate/hooks/useMigrationData', () => ({
  useMigrationData: jest.fn(() => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() })),
}));

// Page resolves navId against the nav index; seed the provisioning node so it
// renders its children instead of a "page not found" state.
const preloadedState = {
  navIndex: {
    provisioning: { id: 'provisioning', text: 'Provisioning', url: '/admin/provisioning' },
  },
};

function renderHomePage(initialEntry = '/admin/provisioning') {
  return render(<HomePage />, {
    preloadedState,
    historyOptions: { initialEntries: [initialEntry] },
  });
}

describe('Provisioning HomePage', () => {
  afterEach(() => {
    config.featureToggles.provisioningExport = false;
  });

  it('hides the Migrate to GitOps tab when the feature flag is off', () => {
    config.featureToggles.provisioningExport = false;
    renderHomePage();

    expect(screen.queryByRole('tab', { name: /migrate to gitops/i })).not.toBeInTheDocument();
  });

  it('shows the Migrate to GitOps tab and renders the placeholder when the flag is on', async () => {
    config.featureToggles.provisioningExport = true;
    const { user } = renderHomePage();

    const migrateTab = screen.getByRole('tab', { name: /migrate to gitops/i });
    expect(migrateTab).toBeInTheDocument();

    await user.click(migrateTab);

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
    expect(screen.getByText(/^experimental$/i)).toBeInTheDocument();
  });

  it('opens directly on the Migrate placeholder when the URL targets it and the flag is on', () => {
    config.featureToggles.provisioningExport = true;
    renderHomePage('/admin/provisioning?tab=migrate');

    expect(screen.getByRole('heading', { name: /migrate to gitops/i })).toBeInTheDocument();
  });

  it('falls back to the default tab when ?tab=migrate is set but the flag is off', () => {
    config.featureToggles.provisioningExport = false;
    renderHomePage('/admin/provisioning?tab=migrate');

    // No repos/connections → default tab is Get started. The Migrate
    // placeholder heading must not render.
    expect(screen.getByText('getting-started-content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /migrate to gitops/i })).not.toBeInTheDocument();
  });
});
