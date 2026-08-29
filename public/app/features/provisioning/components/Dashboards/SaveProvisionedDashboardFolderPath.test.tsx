import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type SaveDashboardDrawer } from 'app/features/dashboard-scene/saving/SaveDashboardDrawer';
import { type DashboardChangeInfo } from 'app/features/dashboard-scene/saving/shared';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { type DashboardMeta } from 'app/types/dashboard';

import { setupProvisioningMswServer } from '../../mocks/server';

import { SaveProvisionedDashboard } from './SaveProvisionedDashboard';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: { ...actual.config, provisioningEnabled: true, featureToggles: { ...actual.config.featureToggles } },
  };
});

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  dashboardWatcher: { ignoreSaveIndefinitely: jest.fn(), clearIgnoreSave: jest.fn(), ignoreNextSave: jest.fn() },
}));

jest.mock('app/features/provisioning/components/Shared/ProvisioningAwareFolderPicker', () => ({
  ProvisioningAwareFolderPicker: ({ onChange }: { onChange: (uid?: string, title?: string) => void }) => (
    <>
      <button type="button" data-testid="pick-folder" onClick={() => onChange('f1', 'Team B')}>
        pick folder
      </button>
      <button type="button" data-testid="pick-orphaned-folder" onClick={() => onChange('f2', 'Ghost Team')}>
        pick orphaned folder
      </button>
    </>
  ),
}));

jest.mock('../../hooks/usePRBranch', () => ({ usePRBranch: jest.fn().mockReturnValue(undefined) }));
jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({ getLastBranch: jest.fn(), setLastBranch: jest.fn() }),
}));
jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: { validateNewDashboardName: jest.fn().mockResolvedValue(true) },
}));

class TestDrawer extends SceneObjectBase<SceneObjectState> {
  public onClose = jest.fn();
  public saveFormDraft: unknown = undefined;
}

/**
 * The defaults recompute only runs when the scene really notifies its subscribers, and that is the
 * render where the form resets itself from them. A jest.fn() setState would skip the regression, so
 * this stand-in uses a real scene object for state.
 */
interface TestDashboardState extends SceneObjectState {
  meta: DashboardMeta;
  title: string;
  description?: string;
  isDirty: boolean;
  uid?: string;
}

class TestDashboard extends SceneObjectBase<TestDashboardState> {
  public getInitialState() {
    return { meta: {} };
  }
  public getSaveModel() {
    return {};
  }
  public getRawJsonFromEditor() {
    return undefined;
  }
  public getSaveResource() {
    return { spec: {} };
  }
  public saveCompleted() {}
  public isManagedRepository() {
    return false;
  }
  public managedResourceCannotBeEdited() {
    return false;
  }
}

function repositoryFolder() {
  return (screen.getByLabelText(/Repository folder/i) as HTMLInputElement).value;
}

function filename() {
  return (screen.getByRole('textbox', { name: /filename/i }) as HTMLInputElement).value;
}

/** Records every distinct value the filename field takes, so a one-render flicker is visible */
function watchFilename(seen: string[]) {
  const observer = new MutationObserver(() => {
    const value = filename();
    if (seen[seen.length - 1] !== value) {
      seen.push(value);
    }
  });
  observer.observe(document.body, { attributes: true, childList: true, subtree: true });
  return observer;
}

function setupServer() {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({
        items: [
          {
            name: 'test-repo',
            title: 'Test Repo',
            type: 'github',
            target: 'folderless',
            workflows: ['write'],
            branch: 'main',
          },
        ],
        legacyStorage: false,
        availableRepositoryTypes: ['github'],
        allowedTargets: ['folder', 'folderless'],
      })
    ),
    http.get('/apis/folder.grafana.app/v1beta1/namespaces/:ns/folders/f1', () =>
      HttpResponse.json({
        apiVersion: 'folder.grafana.app/v1beta1',
        kind: 'Folder',
        metadata: {
          name: 'f1',
          annotations: {
            [AnnoKeyManagerIdentity]: 'test-repo',
            [AnnoKeyManagerKind]: 'repo',
            [AnnoKeySourcePath]: 'team-b',
          },
        },
        spec: { title: 'Team B' },
      })
    ),
    // A folder left behind by a repository that no longer exists in the settings list
    http.get('/apis/folder.grafana.app/v1beta1/namespaces/:ns/folders/f2', () =>
      HttpResponse.json({
        apiVersion: 'folder.grafana.app/v1beta1',
        kind: 'Folder',
        metadata: {
          name: 'f2',
          annotations: {
            [AnnoKeyManagerIdentity]: 'ghost-repo',
            [AnnoKeyManagerKind]: 'repo',
            [AnnoKeySourcePath]: 'ghost-team',
          },
        },
        spec: { title: 'Ghost Team' },
      })
    )
  );
}

function setup() {
  setupServer();

  // A repo file opened before it has a Grafana resource: isNew, but already carrying a source path
  const dashboard = new TestDashboard({
    meta: { folderUid: undefined, k8s: { annotations: { [AnnoKeySourcePath]: 'team-a/seeded.json' } } },
    title: 'My Dash',
    description: '',
    isDirty: true,
  });

  return {
    dashboard,
    ...render(
      <SaveProvisionedDashboard
        dashboard={dashboard as unknown as DashboardScene}
        drawer={new TestDrawer({}) as unknown as SaveDashboardDrawer}
        changeInfo={{ isNew: true, changedSaveModel: {} } as unknown as DashboardChangeInfo}
      />
    ),
  };
}

function setupNewDashboard() {
  setupServer();
  const dashboard = new TestDashboard({
    meta: { folderUid: undefined },
    title: 'My Dash',
    description: '',
    isDirty: true,
  });

  return {
    dashboard,
    ...render(
      <SaveProvisionedDashboard
        dashboard={dashboard as unknown as DashboardScene}
        drawer={new TestDrawer({}) as unknown as SaveDashboardDrawer}
        changeInfo={{ isNew: true, changedSaveModel: {} } as unknown as DashboardChangeInfo}
      />
    ),
  };
}

describe('SaveProvisionedDashboard folder changes with a source path annotation', () => {
  it('moves the file to the repository root when No folder is clicked', async () => {
    const { user } = setup();
    await screen.findByTestId('pick-folder');
    expect(repositoryFolder()).toBe('team-a');

    await user.click(screen.getByRole('button', { name: /No folder \(repository root\)/i }));

    await waitFor(() => expect(repositoryFolder()).toBe(''));
  });

  it('moves the file into a newly picked folder', async () => {
    const { user, dashboard } = setup();
    await screen.findByTestId('pick-folder');

    await user.click(screen.getByTestId('pick-folder'));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBe('f1'));
    await waitFor(() => expect(repositoryFolder()).toBe('team-b'));
  });

  it('returns to the repository root after a provisioned folder was picked', async () => {
    const { user, dashboard } = setup();
    await screen.findByTestId('pick-folder');

    await user.click(screen.getByTestId('pick-folder'));
    await waitFor(() => expect(repositoryFolder()).toBe('team-b'));

    await user.click(screen.getByRole('button', { name: /No folder \(repository root\)/i }));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBeUndefined());
    await waitFor(() => expect(repositoryFolder()).toBe(''));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });

  it('never shows a throwaway timestamped filename while the folder changes', async () => {
    const { user } = setupNewDashboard();
    await screen.findByTestId('pick-folder');
    expect(filename()).toBe('my-dash.json');

    const seen: string[] = [filename()];
    const observer = watchFilename(seen);

    await user.click(screen.getByTestId('pick-folder'));
    await waitFor(() => expect(repositoryFolder()).toBe('team-b'));
    await user.click(screen.getByRole('button', { name: /No folder \(repository root\)/i }));
    await waitFor(() => expect(repositoryFolder()).toBe(''));

    observer.disconnect();

    // The defaults recompute on each pick. Seeding them from a fresh timestamp put a name like
    // new-dashboard-2026-08-27-ab12c.json in the field for the render before the title sync
    expect(seen.filter((value) => /new-dashboard-\d{4}-\d{2}-\d{2}/.test(value))).toEqual([]);
    expect(new Set(seen)).toEqual(new Set(['my-dash.json']));
  });

  it('keeps the form up when a picked folder belongs to a deleted repository, and recovers at root', async () => {
    const { user, dashboard } = setup();
    await screen.findByTestId('pick-folder');

    await user.click(screen.getByTestId('pick-orphaned-folder'));

    // The repository lookup dead-ends on ghost-repo, but the picker must survive to undo the pick
    expect(await screen.findByText(/cannot be saved to/i)).toBeInTheDocument();
    expect(screen.getByTestId('pick-orphaned-folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /No folder \(repository root\)/i }));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBeUndefined());
    await waitFor(() => expect(screen.queryByText(/cannot be saved to/i)).not.toBeInTheDocument());
    await waitFor(() => expect(repositoryFolder()).toBe(''));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled();
  });
});
