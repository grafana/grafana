import { act, render, screen } from '@testing-library/react';

import { ManagerKind } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { RepoViewStatus, useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: { ...actual.config, provisioningEnabled: true },
  };
});

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

// Keep the cold-load lifecycle in one test so earlier renders cannot warm the lazy module cache.
it('loads the banner only after transitioning to Orphaned and forwards the dashboard repository name', async () => {
  const loadBannerModule = jest.fn();
  jest.doMock('../Shared/OrphanedResourceBanner', () => {
    loadBannerModule();
    return {
      OrphanedResourceBanner: ({ repositoryName }: { repositoryName: string }) => (
        <div role="alert">Missing repository: {repositoryName}</div>
      ),
    };
  });

  const { OrphanedDashboardBanner } = await import('./OrphanedDashboardBanner');
  expect(loadBannerModule).not.toHaveBeenCalled();

  const dashboard = {
    getManagerKind: () => ManagerKind.Repo,
    getManagerIdentity: () => 'missing-dashboard-repo',
  } as DashboardScene;
  const mockRepositoryView = jest.mocked(useGetResourceRepositoryView);
  const setStatus = (status: RepoViewStatus) =>
    mockRepositoryView.mockReturnValue({
      status,
      isInstanceManaged: false,
      isReadOnlyRepo: false,
      isMissingRepo: status === RepoViewStatus.Orphaned,
    });

  setStatus(RepoViewStatus.Disabled);
  const { container, rerender } = render(<OrphanedDashboardBanner dashboard={dashboard} />);

  for (const status of [RepoViewStatus.Disabled, RepoViewStatus.Loading, RepoViewStatus.Ready, RepoViewStatus.Error]) {
    setStatus(status);
    await act(async () => {
      rerender(<OrphanedDashboardBanner dashboard={dashboard} />);
    });

    expect(loadBannerModule).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  }

  expect(mockRepositoryView).toHaveBeenLastCalledWith({ name: 'missing-dashboard-repo', skipQuery: false });

  setStatus(RepoViewStatus.Orphaned);
  rerender(<OrphanedDashboardBanner dashboard={dashboard} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Missing repository: missing-dashboard-repo');
  expect(loadBannerModule).toHaveBeenCalledTimes(1);
});
