import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type ResourceObjects, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
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

const mockTriggerRefs = jest.fn();
jest.mock('@grafana/api-clients/rtkq/provisioning/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/provisioning/v0alpha1'),
  useLazyGetRepositoryRefsQuery: () => [mockTriggerRefs, { isFetching: false }],
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
  onSaveToNewBranch?: () => void;
  onDiscardChanges?: () => void;
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

const defaultProps: DashboardPreviewBannerProps = {
  queryParams: {},
  route: DashboardRoutes.Provisioning,
  slug: 'my-repo',
  path: 'dashboards/foo.json',
};

function setup(props: Partial<DashboardPreviewBannerProps> = {}, overrides: SetupOverrides = {}) {
  const mergedProps = { ...defaultProps, ...props };

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
    repository: defaultRepositoryView,
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
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when kiosk is in query params', () => {
      setup({ queryParams: { kiosk: 'tv' } });

      expect(
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when dashboard path is missing', () => {
      setup({ path: undefined });

      expect(
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when route is not Provisioning', () => {
      setup({ route: DashboardRoutes.Normal });

      expect(
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when slug is missing', () => {
      setup({ slug: undefined });

      expect(
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
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
  });

  describe('branch pre-flight on open pull request', () => {
    let windowOpenSpy: jest.SpyInstance;
    let pendingTab: { location: { href: string }; close: jest.Mock };

    beforeEach(() => {
      // The button opens a tab synchronously within the click gesture; the pre-flight then drives it.
      pendingTab = { location: { href: '' }, close: jest.fn() };
      windowOpenSpy = jest.spyOn(window, 'open').mockReturnValue(pendingTab as unknown as Window);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    const clickOpenPullRequest = () =>
      userEvent.setup().click(screen.getByRole('button', { name: /Open pull request in GitHub/i }));

    it('navigates the pre-opened tab to the pull request link when the branch still exists', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'feature-branch' }] }),
      });
      setup();

      await clickOpenPullRequest();

      expect(windowOpenSpy).toHaveBeenCalledWith('about:blank', '_blank');
      await waitFor(() => expect(mockTriggerRefs).toHaveBeenCalledWith({ name: 'my-repo' }));
      await waitFor(() => expect(pendingTab.location.href).toBe('https://github.com/org/repo/compare'));
      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });

    it('closes the tab and offers a way out when the branch is gone', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup();

      await clickOpenPullRequest();

      expect(await screen.findByText('This branch no longer exists')).toBeInTheDocument();
      expect(pendingTab.close).toHaveBeenCalled();
      expect(pendingTab.location.href).toBe('');
    });

    it('re-opens the save flow from the modal', async () => {
      const onSaveToNewBranch = jest.fn();
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup({ onSaveToNewBranch });

      await clickOpenPullRequest();
      await screen.findByText('This branch no longer exists');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Save to a new branch' }));

      expect(onSaveToNewBranch).toHaveBeenCalledTimes(1);
    });

    it('discards changes by clearing the scene then navigating to the saved dashboard', async () => {
      const onDiscardChanges = jest.fn();
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup(
        { onDiscardChanges },
        {
          fileQuery: {
            data: {
              ...defaultFileQueryReturn.data,
              resource: { existing: { metadata: { name: 'original-uid' } } },
            },
          },
        }
      );

      await clickOpenPullRequest();
      await screen.findByText('This branch no longer exists');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Discard changes' }));

      // The scene must be cleared before navigating, or the unsaved-changes prompt blocks it.
      expect(onDiscardChanges).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/d/original-uid');
    });

    it('falls back to opening the link when the refs check fails', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.reject(new Error('boom')),
      });
      setup();

      await clickOpenPullRequest();

      await waitFor(() => expect(pendingTab.location.href).toBe('https://github.com/org/repo/compare'));
      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });
  });

  describe('when the preview ref no longer exists (after a refresh)', () => {
    it('shows a dismissible recovery banner on a 404', async () => {
      setup(
        { queryParams: { ref: 'feature-branch' } },
        { fileQuery: { data: undefined, isError: true, error: { status: 404, data: {} } } }
      );

      expect(screen.getByText('This branch no longer exists')).toBeInTheDocument();

      // The banner is purely informational (the loader already shows the saved version) — it dismisses.
      await userEvent.setup().click(screen.getByRole('button', { name: 'Close alert' }));

      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
      // Dismissing must not fall through to the preview banner: the query has no data, so it would
      // otherwise render a misleading "created in a branch" default.
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Open pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('does not show the recovery banner for non-404 errors', () => {
      setup(
        { queryParams: { ref: 'feature-branch' } },
        { fileQuery: { data: undefined, isError: true, error: { status: 500, data: {} } } }
      );

      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });

    it('does not show the recovery banner while the file query is still loading', () => {
      setup({ queryParams: { ref: 'feature-branch' } }, { fileQuery: { data: undefined, isError: false } });

      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });
  });
});
