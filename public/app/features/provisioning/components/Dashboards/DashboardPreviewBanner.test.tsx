import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types/dashboard';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

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

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetRepositoryFilesWithPathQuery: jest.fn(),
}));

const mockUsePullRequestParam = jest.mocked(usePullRequestParam);
const mockUseGetResourceRepositoryView = jest.mocked(useGetResourceRepositoryView);
const mockUseGetRepositoryFilesWithPathQuery = jest.mocked(useGetRepositoryFilesWithPathQuery);

interface DashboardPreviewBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  route?: string;
  slug?: string;
  path?: string;
}

interface PullRequestParamReturn {
  prURL?: string;
  newPrURL?: string;
  repoURL?: string;
  repoType?: string;
}

interface FileQueryData {
  ref?: string;
  errors?: string[];
  urls?: {
    repositoryURL?: string;
    newPullRequestURL?: string;
    compareURL?: string;
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
  });

  mockUseGetResourceRepositoryView.mockReturnValue({
    repository: defaultRepositoryView,
    repoType: 'github',
    isLoading: false,
    isInstanceManaged: false,
    isReadOnlyRepo: false,
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

    it('calls useGetResourceRepositoryView with slug', () => {
      setup({ slug: 'other-repo' });

      expect(mockUseGetResourceRepositoryView).toHaveBeenCalledWith({ name: 'other-repo' });
    });
  });
});
