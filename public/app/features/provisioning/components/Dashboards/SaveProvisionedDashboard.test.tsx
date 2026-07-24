import { render, screen } from 'test/test-utils';

import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';

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

function createDashboard({
  folderUid,
  uid,
  k8s,
  initialMeta = {},
}: { folderUid?: string; uid?: string; k8s?: DashboardMeta['k8s']; initialMeta?: DashboardMeta } = {}) {
  return {
    state: { meta: { folderUid, uid, k8s } },
    setState: jest.fn(),
    getInitialState: () => ({ meta: initialMeta }),
  } as unknown as DashboardScene;
}

function setup(
  overrides: Partial<ReturnType<typeof useProvisionedDashboardData>> = {},
  props: Partial<SaveProvisionedDashboardProps> = {},
  entryUrl?: string
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

  const renderOptions = entryUrl ? { historyOptions: { initialEntries: [entryUrl] } } : {};

  return { ...render(<SaveProvisionedDashboard {...renderProps} />, renderOptions), props: renderProps };
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

  it('shows the database escape when a new dashboard dead-ends on an orphaned repo', () => {
    setup({
      isNew: false,
      defaultValues: null,
      repository: undefined,
      repoDataStatus: RepoViewStatus.Orphaned,
    });

    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();
  });

  it('does not restore the orphaned folder on switch-back', async () => {
    const dashboard = createDashboard({ folderUid: 'orphaned-folder' });
    const { user } = setup(
      { isNew: false, defaultValues: null, repository: undefined, repoDataStatus: RepoViewStatus.Orphaned },
      { dashboard },
      '/?folderUid=repo-folder'
    );

    await user.click(screen.getByRole('button', { name: /grafana database/i }));
    await user.click(screen.getByRole('button', { name: /git repository/i }));

    // Restoring the orphaned folder would bounce straight back to the orphaned notice
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: 'repo-folder' } });
  });

  it('drops repo manager annotations when switching to the database form', async () => {
    const dashboard = createDashboard({
      folderUid: 'provisioned-folder',
      k8s: {
        annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo, [AnnoKeyManagerIdentity]: 'test-repo' },
      },
    });
    const { user } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Left behind, saveCompleted would carry them forward and the saved dashboard would look repo-managed
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined, k8s: undefined } });
  });

  it('clears the orphaned folder when escaping to the database form', async () => {
    const dashboard = createDashboard({ folderUid: 'orphaned-folder' });
    const { user } = setup(
      { isNew: false, defaultValues: null, repository: undefined, repoDataStatus: RepoViewStatus.Orphaned },
      { dashboard }
    );

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // An orphaned folder still carries repo annotations, so a database save into it would be rejected
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined } });
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

  it('drops database-form folder annotations when switching back to Git', async () => {
    const dashboard = createDashboard({ folderUid: undefined });
    const { user } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // The database form picks a repo-managed folder, writing manager annotations onto the meta
    dashboard.state.meta = {
      folderUid: 'db-managed-folder',
      k8s: { annotations: { 'grafana.app/managedBy': 'repo' } },
    } as DashboardMeta;

    await user.click(screen.getByRole('button', { name: /git repository/i }));

    // The restore reinstates the git-flow meta wholesale, so no stale annotations leak back
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined } });
  });

  it('keeps the picked folder when escaping to the database form after a dead-end', async () => {
    const dashboard = createDashboard({ folderUid: 'db-folder-uid' });
    const { user } = setup(
      { isNew: false, defaultValues: null, repository: undefined, repoDataStatus: RepoViewStatus.Error },
      { dashboard }
    );

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    expect(screen.getByTestId('database-form')).toBeInTheDocument();
    // The unmanaged folder is a valid database folder and must not be cleared
    expect(dashboard.setState).not.toHaveBeenCalledWith({ meta: { folderUid: undefined } });
  });

  it('clears the folder when escaping while the repository is still loading', async () => {
    const dashboard = createDashboard({ folderUid: 'loading-folder' });
    const { user, rerender, props } = setup({}, { dashboard });

    // A provisioned subfolder pick puts the folder query into loading, repository transiently undefined
    mockUseProvisionedDashboardData.mockReturnValue({
      isNew: true,
      defaultValues: null,
      canPushToConfiguredBranch: false,
      readOnly: true,
      repository: undefined,
      repoDataStatus: RepoViewStatus.Loading,
    } as unknown as ReturnType<typeof useProvisionedDashboardData>);
    rerender(<SaveProvisionedDashboard {...props} />);

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Loading is not a confirmed dead-end, so the still-provisioned folder must be cleared
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: undefined } });
  });

  it('restores the entry folder on switch-back so a folder-target Git form resolves again', async () => {
    const dashboard = createDashboard({ folderUid: 'unmanaged-folder' });
    const { user } = setup(
      { isNew: false, defaultValues: null, repository: undefined, repoDataStatus: RepoViewStatus.Error },
      { dashboard },
      '/?folderUid=repo-folder'
    );

    await user.click(screen.getByRole('button', { name: /grafana database/i }));
    await user.click(screen.getByRole('button', { name: /git repository/i }));

    // Switch-back restores the folder the drawer resolved from, not root, so the Git form can resolve
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: 'repo-folder' } });
  });

  it('resets a new dashboard to its initial meta when the database form is cancelled', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { user, unmount } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Simulate a folder pick in the database form, then Cancel unmounting the drawer without drawer.onClose
    dashboard.state.meta.folderUid = 'db-folder-uid';
    unmount();

    // Matches drawer.onClose, so closing with the X isn't undone by putting the git-flow meta back
    expect(dashboard.setState).toHaveBeenCalledWith({ meta: {} });
    expect(dashboard.setState).not.toHaveBeenCalledWith({ meta: { folderUid: 'git-folder-uid' } });
  });

  it('does not restore the folder when unmounting after a completed database save', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid' });
    const { user, unmount } = setup({}, { dashboard });

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // A completed save assigns a new uid via saveCompleted before the overlay closes
    dashboard.state.meta.uid = 'saved-uid';
    dashboard.state.meta.folderUid = 'db-folder-uid';
    unmount();

    expect(dashboard.setState).not.toHaveBeenCalledWith({
      meta: expect.objectContaining({ folderUid: 'git-folder-uid' }),
    });
  });

  it('restores the git-flow folder on cancel even for a save-as-copy of an existing dashboard', async () => {
    const dashboard = createDashboard({ folderUid: 'git-folder-uid', uid: 'existing-uid' });
    const { user, unmount } = setup(
      { isNew: false },
      { dashboard, saveAsCopy: true, changeInfo: { isNew: false } as unknown as DashboardChangeInfo }
    );

    await user.click(screen.getByRole('button', { name: /grafana database/i }));

    // Cancel leaves the uid untouched (no new resource created), so the restore must still run
    dashboard.state.meta.folderUid = 'db-folder-uid';
    unmount();

    expect(dashboard.setState).toHaveBeenCalledWith({ meta: { folderUid: 'git-folder-uid', uid: 'existing-uid' } });
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
