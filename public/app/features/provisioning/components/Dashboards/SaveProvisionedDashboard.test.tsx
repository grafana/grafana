import { render, screen } from 'test/test-utils';

import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

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

  return render(
    <SaveProvisionedDashboard
      dashboard={{} as DashboardScene}
      drawer={{ onClose: jest.fn() } as unknown as SaveDashboardDrawer}
      changeInfo={{} as unknown as DashboardChangeInfo}
      {...props}
    />
  );
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
    setup({ isNew: false });

    expect(screen.queryByRole('button', { name: /grafana database/i })).not.toBeInTheDocument();
  });

  it('shows the switch link when saving a copy of an existing folderless dashboard', () => {
    setup({ isNew: false }, { saveAsCopy: true });

    expect(screen.getByRole('button', { name: /grafana database/i })).toBeInTheDocument();
  });
});
