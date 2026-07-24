import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
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
      featureToggles: { provisioning: true },
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
    existing?: { metadata?: { name?: string } };
  };
}

interface SetupOverrides {
  pullRequestParam?: PullRequestParamReturn;
  fileQuery?: { data: FileQueryData; isLoading?: boolean; error?: unknown };
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
    resource: {
      existing: { metadata: { name: 'dash-uid' } },
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
    (config.featureToggles as { provisioning: boolean }).provisioning = true;
  });

  describe('when banner should not render', () => {
    it('returns null when provisioning is disabled', () => {
      (config.featureToggles as { provisioning: boolean }).provisioning = false;
      setup();

      expect(
        screen.queryByRole('button', { name: /Open a pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when kiosk is in query params', () => {
      setup({ queryParams: { kiosk: 'tv' } });

      expect(
        screen.queryByRole('button', { name: /Open a pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when dashboard path is missing', () => {
      setup({ path: undefined });

      expect(
        screen.queryByRole('button', { name: /Open a pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when route is not Provisioning', () => {
      setup({ route: DashboardRoutes.Normal });

      expect(
        screen.queryByRole('button', { name: /Open a pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
    });

    it('returns null when slug is missing', () => {
      setup({ slug: undefined });

      expect(
        screen.queryByRole('button', { name: /Open a pull request in|View pull request in/i })
      ).not.toBeInTheDocument();
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
      expect(screen.getByText('Open a pull request in GitHub')).toBeInTheDocument();
    });

    it('calls useGetResourceRepositoryView with slug', () => {
      setup({ slug: 'other-repo' });

      expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({ name: 'other-repo' });
    });
  });

  describe('branch pre-flight on open pull request', () => {
    let windowOpenSpy: jest.SpyInstance;

    beforeEach(() => {
      windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
    });

    const clickButton = () => userEvent.click(screen.getByRole('button', { name: /close alert/i }));

    it('opens the pull request link when the branch still exists', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'feature-branch' }] }),
      });
      setup();

      await clickButton();

      await waitFor(() => expect(mockTriggerRefs).toHaveBeenCalledWith({ name: 'my-repo' }));
      expect(windowOpenSpy).toHaveBeenCalledWith('https://github.com/org/repo/compare', '_blank');
      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });

    it('offers a way out when the branch is gone', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup();

      await clickButton();

      expect(await screen.findByText('This branch no longer exists')).toBeInTheDocument();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('re-opens the save flow from the modal', async () => {
      const onSaveToNewBranch = jest.fn();
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup({ onSaveToNewBranch });

      await clickButton();
      await screen.findByText('This branch no longer exists');
      await userEvent.click(screen.getByRole('button', { name: 'Save to a new branch' }));

      expect(onSaveToNewBranch).toHaveBeenCalledTimes(1);
    });

    it('navigates to the live current dashboard from the modal', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      setup();

      await clickButton();
      await screen.findByText('This branch no longer exists');
      await userEvent.click(screen.getByRole('button', { name: 'View the current version' }));

      expect(mockNavigate).toHaveBeenCalledWith('/d/dash-uid');
    });

    it('hides the current-version option when the dashboard was never merged', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.resolve({ items: [{ name: 'some-other-branch' }] }),
      });
      // No `resource.existing` → the dashboard only ever lived on the (now-gone) branch.
      setup(
        {},
        {
          fileQuery: {
            data: {
              ref: 'feature-branch',
              urls: { newPullRequestURL: 'https://github.com/org/repo/compare' },
            },
          },
        }
      );

      await clickButton();
      await screen.findByText('This branch no longer exists');

      expect(screen.queryByRole('button', { name: 'View the current version' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save to a new branch' })).toBeInTheDocument();
    });

    it('falls back to opening the link when the refs check fails', async () => {
      mockTriggerRefs.mockReturnValue({
        unwrap: () => Promise.reject(new Error('boom')),
      });
      setup();

      await clickButton();

      await waitFor(() => expect(windowOpenSpy).toHaveBeenCalledWith('https://github.com/org/repo/compare', '_blank'));
      expect(screen.queryByText('This branch no longer exists')).not.toBeInTheDocument();
    });
  });
});
