import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type ResourceObjects, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types/dashboard';

import { RepoViewStatus, useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

import { DashboardPreviewBanner } from './DashboardPreviewBanner';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      provisioningEnabled: true,
    },
  };
});

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => ({
  usePullRequestParam: jest.fn(),
}));

jest.mock('../../hooks/useGetResourceRepositoryView', () => {
  const actual = jest.requireActual('../../hooks/useGetResourceRepositoryView');
  return {
    ...actual,
    useGetResourceRepositoryView: jest.fn(),
  };
});

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

const mockUsePullRequestParam = jest.mocked(usePullRequestParam);
const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  slug?: string;
  path?: string;
  dashboard: DashboardScene;
}

interface PullRequestParamReturn {
  prURL?: string;
  newPrURL?: string;
  repoURL?: string;
  repoType?: 'github' | 'githubEnterprise' | 'gitlab' | 'bitbucket' | 'git' | 'local';
}

interface FileQueryData {
  ref?: string;
  errors?: string[];
  urls?: {
    repositoryURL?: string;
    newPullRequestURL?: string;
    compareURL?: string;
  };
  resource?: {
    action?: ResourceObjects['action'];
    existing?: {
      metadata?: {
        name?: string;
      };
    };
  };
}

interface SetupOverrides {
  pullRequestParam?: PullRequestParamReturn;
  fileQuery?: { data?: FileQueryData; isLoading?: boolean; isError?: boolean; error?: unknown };
  repositoryView?: Partial<typeof defaultRepositoryView>;
}

const defaultRepositoryView = {
  branch: 'main',
  url: 'https://github.com/org/repo',
  name: 'my-repo',
  target: 'folder' as const,
  title: 'Test Repo',
  type: 'github' as const,
  workflows: ['branch', 'write'] as Array<'branch' | 'write'>,
};

const defaultFileQueryReturn = {
  data: {
    ref: 'feature-branch',
    urls: {
      repositoryURL: 'https://github.com/org/repo',
      newPullRequestURL: 'https://github.com/org/repo/compare',
      compareURL: 'https://github.com/org/repo/compare',
    },
  },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
};

// The loader records the ref it actually loaded from as a `#ref` fragment on the sourcePath
// annotation, and leaves it off when it fell back to the configured branch.
function createDashboard({ loadedRef, isEditing = false }: { loadedRef?: string; isEditing?: boolean } = {}) {
  const sourcePath = loadedRef ? `dashboards/foo.json#${loadedRef}` : 'dashboards/foo.json';
  return {
    state: { isEditing, meta: { k8s: { annotations: { [AnnoKeySourcePath]: sourcePath } } } },
    onEnterEditMode: jest.fn(),
    openSaveDrawer: jest.fn(),
    exitEditMode: jest.fn(),
  } as unknown as DashboardScene;
}

const defaultProps: Omit<DashboardPreviewBannerProps, 'dashboard'> = {
  queryParams: {},
  route: DashboardRoutes.Provisioning,
  slug: 'my-repo',
  path: 'dashboards/foo.json',
};

function setup(props: Partial<DashboardPreviewBannerProps> = {}, overrides: SetupOverrides = {}) {
  const mergedProps = { ...defaultProps, dashboard: createDashboard(), ...props };

  mockUsePullRequestParam.mockReturnValue({
    prURL: undefined,
    newPrURL: undefined,
    repoURL: undefined,
    repoType: 'github',
    ...overrides.pullRequestParam,
    resourcePushedTo: 'abc',
    action: 'create',
    prTitle: undefined,
  });

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: { ...defaultRepositoryView, ...overrides.repositoryView },
    repoType: 'github',
    status: RepoViewStatus.Ready,
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
    isMissingRepo: false,
  });

  mockUseGetRepositoryFilesWithPathQuery.mockReturnValue({
    ...defaultFileQueryReturn,
    ...overrides.fileQuery,
    refetch: defaultFileQueryReturn.refetch,
  });

  const renderResult = render(<DashboardPreviewBanner {...mergedProps} />);

  return {
    props: mergedProps,
    ...renderResult,
  };
}

describe('DashboardPreviewBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as { provisioningEnabled: boolean }).provisioningEnabled = true;
    // locationUtil keeps module-level config, so reset it between tests
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
  });

  describe('when banner should not render', () => {
    it('returns null when provisioning is disabled', () => {
      (config as { provisioningEnabled: boolean }).provisioningEnabled = false;
      setup();

      expect(
        screen.queryByRole('link', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when kiosk is in query params', () => {
      setup({ queryParams: { kiosk: 'tv' } });

      expect(
        screen.queryByRole('link', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when dashboard path is missing', () => {
      setup({ path: undefined });

      expect(
        screen.queryByRole('link', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when route is not Provisioning', () => {
      setup({ route: DashboardRoutes.Normal });

      expect(
        screen.queryByRole('link', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when slug is missing', () => {
      setup({ slug: undefined });

      expect(
        screen.queryByRole('link', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null while the file query is loading', () => {
      setup({}, { fileQuery: { data: {}, isLoading: true, error: null } });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('when banner renders content', () => {
    it('renders error alert when file query returns errors', () => {
      setup(
        {},
        {
          fileQuery: {
            data: { errors: ['File not found', 'Permission denied'] },
            isLoading: false,
            error: null,
          },
        }
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
    });

    it('renders preview banner with existing PR when PR URL is from hook', () => {
      setup(
        {},
        {
          pullRequestParam: {
            prURL: 'https://github.com/org/repo/pull/123',
            newPrURL: undefined,
            repoURL: undefined,
            repoType: 'github',
          },
        }
      );

      expect(
        screen.getByRole('status', {
          name: 'This resource is loaded from the branch you just created in GitHub and it is only visible to you',
        })
      ).toBeInTheDocument();
      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });

    it('renders preview banner for new PR when PR URL is from file data', () => {
      setup();

      expect(
        screen.getByRole('status', {
          name: 'A new resource has been created in a branch in GitHub.',
        })
      ).toBeInTheDocument();
      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });

    it('uses resource.action for the title so an edit without a PR URL is not labelled as created', () => {
      setup(
        {},
        {
          fileQuery: {
            data: {
              ref: 'feature-branch',
              urls: defaultFileQueryReturn.data.urls,
              resource: { action: 'update' },
            },
            isLoading: false,
            error: null,
          },
        }
      );

      expect(
        screen.getByRole('status', {
          name: 'A resource has been updated in a branch in GitHub.',
        })
      ).toBeInTheDocument();
      expect(screen.queryByText('A new resource has been created in a branch in GitHub.')).not.toBeInTheDocument();
    });

    it('renders a link to the saved dashboard when it already exists in Grafana', () => {
      setup(
        {},
        {
          fileQuery: {
            data: {
              ...defaultFileQueryReturn.data,
              resource: { existing: { metadata: { name: 'original-uid' } } },
            },
            isLoading: false,
            error: null,
          },
        }
      );

      const link = screen.getByRole('link', { name: 'View saved version' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/d/original-uid');
    });

    it('prefixes the saved dashboard link with the configured app sub url', () => {
      // Opening the link in a new tab bypasses the router, so the href itself has to be valid
      // under a subpath install.
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });

      setup(
        {},
        {
          fileQuery: {
            data: {
              ...defaultFileQueryReturn.data,
              resource: { existing: { metadata: { name: 'original-uid' } } },
            },
            isLoading: false,
            error: null,
          },
        }
      );

      expect(screen.getByRole('link', { name: 'View saved version' })).toHaveAttribute(
        'href',
        '/grafana/d/original-uid'
      );
    });

    it('does not render a link to the saved dashboard when it does not exist yet', () => {
      setup();

      expect(screen.queryByRole('link', { name: 'View saved version' })).not.toBeInTheDocument();
    });

    it('calls useGetResourceRepositoryView with slug', () => {
      setup({ slug: 'other-repo' });

      expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({ name: 'other-repo' });
    });

    it('refetches the file on focus so a branch deleted in another tab is noticed on return', () => {
      setup({ queryParams: { ref: 'feature-branch' } });

      expect(mockUseGetRepositoryFilesWithPathQuery).toHaveBeenCalledWith(
        { name: 'my-repo', path: 'dashboards/foo.json', ref: 'feature-branch' },
        { refetchOnFocus: true }
      );
    });
  });

  describe('when the preview branch has been deleted (file query 404s)', () => {
    const notFound = { status: 404, data: {} };
    const previewParams = { queryParams: { ref: 'feature-branch' } };

    // RTK keeps the last successful `data` after a failed refetch, so a live preview still has the
    // dry-run result to drive the recovery actions from.
    const liveQuery = (resource: FileQueryData['resource']) => ({
      fileQuery: { data: { ...defaultFileQueryReturn.data, resource }, isError: true, error: notFound },
    });

    describe('while the scene still holds the content loaded from that branch', () => {
      it('offers to save the draft to a new branch or discard it, instead of a dead pull request link', () => {
        setup({ ...previewParams, dashboard: createDashboard({ loadedRef: 'feature-branch' }) }, liveQuery({}));

        expect(screen.getByText('This branch no longer exists')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save to a new branch' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /pull request in GitHub/i })).not.toBeInTheDocument();
      });

      it('enters edit mode and opens the save drawer defaulted to a new branch', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch' });
        setup({ ...previewParams, dashboard }, liveQuery({ existing: { metadata: { name: 'original-uid' } } }));

        await userEvent.setup().click(screen.getByRole('button', { name: 'Save to a new branch' }));

        expect(dashboard.onEnterEditMode).toHaveBeenCalledTimes(1);
        // The dashboard also exists on the configured branch, so the recovery save can update it.
        expect(dashboard.openSaveDrawer).toHaveBeenCalledWith({
          recoverToNewBranch: { fileExistsOnConfiguredBranch: true },
        });
      });

      it('flags the recovery save as a create when the dashboard only ever existed on the deleted branch', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch' });
        // No `existing` means the file was born on the (now deleted) branch and never merged, so the
        // recovery branch — cut from the configured branch — doesn't have it to update.
        setup({ ...previewParams, dashboard }, liveQuery({ action: 'create' }));

        await userEvent.setup().click(screen.getByRole('button', { name: 'Save to a new branch' }));

        expect(dashboard.openSaveDrawer).toHaveBeenCalledWith({
          recoverToNewBranch: { fileExistsOnConfiguredBranch: false },
        });
      });

      it('offers a plain save when the repository only allows writes, since it cannot branch', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch' });
        setup({ ...previewParams, dashboard }, { ...liveQuery({}), repositoryView: { workflows: ['write'] } });

        expect(screen.queryByRole('button', { name: 'Save to a new branch' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();

        // The draft is still recoverable: the form defaults to the configured branch instead.
        await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }));
        expect(dashboard.openSaveDrawer).toHaveBeenCalledWith({
          recoverToNewBranch: { fileExistsOnConfiguredBranch: false },
        });
      });

      it('still offers recovery when the last dry-run had errors', () => {
        // The stale payload (kept by RTK after the 404) carried errors; the deleted branch matters more.
        setup(
          { ...previewParams, dashboard: createDashboard({ loadedRef: 'feature-branch' }) },
          {
            fileQuery: {
              data: { ...defaultFileQueryReturn.data, errors: ['Invalid dashboard'] },
              isError: true,
              error: notFound,
            },
          }
        );

        expect(screen.getByRole('button', { name: 'Save to a new branch' })).toBeInTheDocument();
        expect(screen.queryByText('Error loading dashboard')).not.toBeInTheDocument();
      });

      it('does not re-enter edit mode when already editing, which would reset the dirty state', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch', isEditing: true });
        setup({ ...previewParams, dashboard }, liveQuery({ existing: { metadata: { name: 'original-uid' } } }));

        await userEvent.setup().click(screen.getByRole('button', { name: 'Save to a new branch' }));

        expect(dashboard.onEnterEditMode).not.toHaveBeenCalled();
        expect(dashboard.openSaveDrawer).toHaveBeenCalledTimes(1);
      });

      it('discards by clearing the edit state before navigating to the saved dashboard', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch', isEditing: true });
        setup({ ...previewParams, dashboard }, liveQuery({ existing: { metadata: { name: 'original-uid' } } }));

        await userEvent.setup().click(screen.getByRole('button', { name: 'Discard changes' }));

        // Otherwise the unsaved-changes prompt blocks the navigation.
        expect(dashboard.exitEditMode).toHaveBeenCalledWith({ skipConfirm: true, restoreInitialState: true });
        expect(mockNavigate).toHaveBeenCalledWith('/d/original-uid');
      });

      it('discards to the dashboard list when the dashboard was never saved to the configured branch', async () => {
        const dashboard = createDashboard({ loadedRef: 'feature-branch' });
        setup({ ...previewParams, dashboard }, liveQuery({ action: 'create' }));

        await userEvent.setup().click(screen.getByRole('button', { name: 'Discard changes' }));

        expect(dashboard.exitEditMode).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
      });
    });

    describe('after a refresh, when the loader already fell back to the saved version', () => {
      it('shows a dismissible notice with no recovery actions', async () => {
        // The first fetch failed, so there is no data at all — and no `#ref` on the scene.
        setup(
          { ...previewParams, dashboard: createDashboard() },
          { fileQuery: { data: undefined, isError: true, error: notFound } }
        );

        expect(screen.getByText('This branch no longer exists')).toBeInTheDocument();
        expect(screen.getByText(/You are now viewing the saved version/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save to a new branch' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();

        await userEvent.setup().click(screen.getByRole('button', { name: 'Close alert' }));

        expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
        // Dismissing must not fall through to the preview banner: the query has no data, so it would
        // otherwise render a misleading "created in a branch" default.
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });

    it('does not show the recovery banner for non-404 errors', () => {
      setup(
        { ...previewParams, dashboard: createDashboard({ loadedRef: 'feature-branch' }) },
        { fileQuery: { data: undefined, isError: true, error: { status: 500, data: {} } } }
      );

      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });

    it('does not show the recovery banner while the file query is still loading', () => {
      setup(previewParams, { fileQuery: { data: undefined, isError: false } });

      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });
  });
});
