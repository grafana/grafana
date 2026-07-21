import { render, screen } from 'test/test-utils';

import { appEvents } from 'app/core/app_events';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardSavedEvent } from 'app/types/events';

import { RepoViewStatus } from '../../hooks/useGetResourceRepositoryView';
import { useProvisionedDashboardData } from '../../hooks/useProvisionedDashboardData';

import { SaveProvisionedDashboard, type SaveProvisionedDashboardProps } from './SaveProvisionedDashboard';

jest.mock('../../hooks/useProvisionedDashboardData', () => ({
  useProvisionedDashboardData: jest.fn(),
}));

jest.mock('./SaveProvisionedDashboardForm', () => ({
  SaveProvisionedDashboardForm: () => <div data-testid="provisioned-form">Provisioned form</div>,
}));

jest.mock('app/features/dashboard-scene/saving/SaveDashboardAsForm', () => ({
  SaveDashboardAsForm: () => <div data-testid="database-form">Database form</div>,
}));

const mockUseProvisionedDashboardData = jest.mocked(useProvisionedDashboardData);

function createDashboard({ folderUid, uid }: { folderUid?: string; uid?: string } = {}) {
  return {
    state: { meta: { folderUid, uid } },
    setState: jest.fn(),
  } as unknown as DashboardScene;
}

function setup(
  overrides: Partial<ReturnType<typeof useProvisionedDashboardData>> = {},
  props: Partial<SaveProvisionedDashboardProps> = {}
) {
  mockUseProvisionedDashboardData.mockReturnValue({
    isNew: true,
    defaultValues: {
      ref: 'main',
      path: 'test-dashboard.json',
      repo: 'test-repo',
      comment: '',
      folder: { uid: '', title: '' },
      title: 'Test Dashboard',
      description: '',
      workflow: 'write',
    },
    canPushToConfiguredBranch: true,
    readOnly: false,
    repository: {
      type: 'github',
      name: 'test-repo',
      title: 'Test Repo',
      workflows: ['write'],
      target: 'folderless',
    },
    repoDataStatus: RepoViewStatus.Ready,
    ...overrides,
  } as unknown as ReturnType<typeof useProvisionedDashboardData>);

  const renderProps: SaveProvisionedDashboardProps = {
    dashboard: createDashboard(),
    drawer: { onClose: jest.fn() } as unknown as SaveDashboardDrawer,
    changeInfo: { isNew: true } as unknown as DashboardChangeInfo,
    ...props,
  };

  return { ...render(<SaveProvisionedDashboard {...renderProps} />), props: renderProps };
}

describe('SaveProvisionedDashboard', () => {
  it('shows the provisioned form with a link to switch to the database for a new folderless dashboard', () => {
    setup();

    expect(screen.getByTestId('provisioned-form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();
    expect(screen.queryByTestId('database-form')).not.toBeInTheDocument();
  });

  it('switches to the database form when the link is clicked, and back again', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /grafana database/i }));
    expect(screen.getByTestId('database-form')).toBeInTheDocument();
    expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /git repository/i }));
    expect(screen.getByTestId('provisioned-form')).toBeInTheDocument();
    expect(screen.queryByTestId('database-form')).not.toBeInTheDocument();
  });

  it('does not show the switch link for a non-folderless repository', () => {
    setup({
      repository: { type: 'github', name: 'test-repo', title: 'Test Repo', workflows: ['write'], target: 'folder' },
    });

    expect(screen.queryByRole('button', { name: /grafana database/i })).not.toBeInTheDocument();
  });

  it('does not show the switch link for an existing dashboard', () => {
    setup({ isNew: false }, { changeInfo: { isNew: false } as unknown as DashboardChangeInfo });

    expect(screen.queryByRole('button', { name: /grafana database/i })).not.toBeInTheDocument();
  });

  it('shows the switch link when saving a copy of an existing folderless dashboard', () => {
    setup({ isNew: false }, { saveAsCopy: true, changeInfo: { isNew: false } as unknown as DashboardChangeInfo });

    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();
  });

  it('shows the database escape when a new dashboard dead-ends on a non-folderless repo', () => {
    setup({
      isNew: false,
      defaultValues: null,
      repository: undefined,
      repoDataStatus: RepoViewStatus.Error,
    });

    expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();
  });

  it('keeps the database form when the repository stops resolving after a folder pick', async () => {
    const { user, rerender, props } = setup();

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Picking a database folder in the swapped-in form makes the folderless repo stop resolving
    mockUseProvisionedDashboardData.mockReturnValue({
      isNew: true,
      defaultValues: null,
      canPushToConfiguredBranch: false,
      readOnly: true,
      repository: undefined,
      repoDataStatus: RepoViewStatus.Error,
    } as unknown as ReturnType<typeof useProvisionedDashboardData>);
    rerender(<SaveProvisionedDashboard {...props} />);

    expect(screen.getByTestId('database-form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /git repository/i })).toBeInTheDocument();
  });

  it('restores the git-flow folder when switching back from the database form', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { user } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Simulate the database form pointing the dashboard meta at a plain database folder
    dashboard.state.meta.folderUid = 'db-folder-uid';

    await user.click(screen.getByRole('button', { name: /git repository/i }));

    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: 'git-folder-uid' } });
    expect(screen.getByTestId('provisioned-form')).toBeInTheDocument();
  });

  it('restores the git-flow folder when the database form is cancelled via closeModal', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { user, unmount } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Simulate a folder pick in the database form, then Cancel unmounting the drawer without drawer.onClose
    dashboard.state.meta.folderUid = 'db-folder-uid';
    unmount();

    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: 'git-folder-uid' } });
  });

  it('does not restore the folder when unmounting after a completed database save', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { user, unmount } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // useSaveDashboard publishes this before the overlay closes
    appEvents.publish(new DashboardSavedEvent());
    dashboard.state.meta.folderUid = 'db-folder-uid';
    unmount();

    expect(dashboard.setState).not.toHaveBeenCalledWith({
      meta: expect.objectContaining({ folderUid: 'git-folder-uid' }),
    });
  });

  it('clears the folder when switching to the database form', async () => {
    const dashboard = createDashboard({ folderUid: 'repo-managed-folder' });
    const { user } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined } });
  });

  it('hides the switch link when the repository resolves to a non-folderless repo', async () => {
    const { rerender, props } = setup();

    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();

    mockUseProvisionedDashboardData.mockReturnValue({
      isNew: true,
      defaultValues: null,
      canPushToConfiguredBranch: false,
      readOnly: false,
      repository: { type: 'github', name: 'folder-repo', title: 'Folder Repo', workflows: ['write'], target: 'folder' },
      repoDataStatus: RepoViewStatus.Ready,
    } as unknown as ReturnType<typeof useProvisionedDashboardData>);
    rerender(<SaveProvisionedDashboard {...props} />);

    expect(screen.queryByRole('button', { name: /grafana database/i })).not.toBeInTheDocument();
  });

  it('keeps the database switch link as an escape when the git flow stops resolving', async () => {
    const dashboard = createDashboard();
    const { user, rerender, props } = setup({}, { dashboard });

    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();

    // Picking an unmanaged database folder in the git form collapses it into the error gate
    dashboard.state.meta.folderUid = 'db-folder-uid';
    mockUseProvisionedDashboardData.mockReturnValue({
      isNew: false,
      defaultValues: null,
      canPushToConfiguredBranch: false,
      readOnly: true,
      repository: undefined,
      repoDataStatus: RepoViewStatus.Error,
    } as unknown as ReturnType<typeof useProvisionedDashboardData>);
    rerender(<SaveProvisionedDashboard {...props} />);

    expect(screen.queryByTestId('provisioned-form')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    expect(screen.getByTestId('database-form')).toBeInTheDocument();

    // Switching back must not restore the unresolvable folder
    await user.click(screen.getByRole('button', { name: /git repository/i }));
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined } });
  });

  it('does not touch the dashboard meta when unmounting from the git flow', () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { unmount } = setup({}, { dashboard });

    unmount();

    expect(dashboard.setState).not.toHaveBeenCalled();
  });
});
