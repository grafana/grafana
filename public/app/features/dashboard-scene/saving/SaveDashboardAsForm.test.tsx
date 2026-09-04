import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'test/test-utils';

import {
  AnnoKeyIgnorePredefinedVariables,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';
import { getProvisionedMeta } from 'app/features/provisioning/components/utils/getProvisionedMeta';
import { type DashboardMeta } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardAsForm, nextMetaAfterSaveAsFolderChange } from './SaveDashboardAsForm';
import { type SaveDashboardDrawer } from './SaveDashboardDrawer';
import { type DashboardChangeInfo } from './shared';

jest.mock('app/core/components/Select/FolderPicker', () => ({
  FolderPicker: ({ onChange }: { onChange: (uid?: string, title?: string) => void }) => (
    <>
      <button type="button" onClick={() => onChange('repo-folder', 'Repo Folder')}>
        Pick repo folder
      </button>
      <button type="button" onClick={() => onChange('other-folder', 'Other Folder')}>
        Pick other folder
      </button>
    </>
  ),
}));

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: { validateNewDashboardName: jest.fn().mockResolvedValue(true) },
}));

jest.mock('app/features/provisioning/components/utils/getProvisionedMeta', () => ({
  getProvisionedMeta: jest.fn().mockResolvedValue({
    k8s: { annotations: { 'grafana.app/managedBy': 'repo', 'grafana.app/managerId': 'my-repo' } },
  }),
}));

describe('nextMetaAfterSaveAsFolderChange', () => {
  it('preserves k8s name and resourceVersion when switching folders', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '42',
          annotations: {
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'new-folder',
      {}
    );

    expect(next.folderUid).toBe('new-folder');
    expect(next.k8s?.name).toBe('dash-uid');
    expect(next.k8s?.resourceVersion).toBe('42');
    expect(next.k8s?.annotations?.[AnnoKeyIgnorePredefinedVariables]).toBe('global');
  });

  it('overlays provisioned manager annotations without dropping identity fields', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'old-folder',
        k8s: {
          name: 'dash-uid',
          resourceVersion: '7',
          annotations: {
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'repo-folder',
      {
        k8s: {
          annotations: {
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeyManagerKind]: ManagerKind.Repo,
          },
        },
      }
    );

    expect(next.k8s?.name).toBe('dash-uid');
    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyIgnorePredefinedVariables]: 'global',
      [AnnoKeyManagerIdentity]: 'my-repo',
      [AnnoKeyManagerKind]: ManagerKind.Repo,
    });
  });

  it('drops the source path so the recomputed default path follows the new folder', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'repo-folder',
        k8s: {
          name: 'dash-uid',
          annotations: {
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeySourcePath]: 'team-a/dash.json',
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      undefined,
      {}
    );

    expect(next.k8s?.annotations?.[AnnoKeySourcePath]).toBeUndefined();
    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyIgnorePredefinedVariables]: 'global',
    });
  });

  it('clears previous folder manager annotations when moving to a non-provisioned folder', () => {
    const next = nextMetaAfterSaveAsFolderChange(
      {
        folderUid: 'repo-folder',
        k8s: {
          name: 'dash-uid',
          annotations: {
            [AnnoKeyManagerIdentity]: 'my-repo',
            [AnnoKeyManagerKind]: ManagerKind.Repo,
            [AnnoKeyIgnorePredefinedVariables]: 'global',
          },
        },
      },
      'plain-folder',
      {}
    );

    expect(next.k8s?.annotations).toEqual({
      [AnnoKeyIgnorePredefinedVariables]: 'global',
    });
  });
});

type ProvisionedMeta = Awaited<ReturnType<typeof getProvisionedMeta>>;

describe('SaveDashboardAsForm folder picker', () => {
  function createDashboard(meta: DashboardMeta) {
    const state = { meta };
    return {
      state,
      setState: jest.fn(({ meta }: { meta: DashboardMeta }) => {
        state.meta = meta;
      }),
      serializer: { getK8SMetadata: () => undefined },
      closeModal: jest.fn(),
    } as unknown as DashboardScene;
  }

  function setup(saveToDatabase?: boolean, meta: DashboardMeta = { folderUid: undefined }) {
    const dashboard = createDashboard(meta);
    const drawer = { state: { saveToDatabase } } as unknown as SaveDashboardDrawer;

    render(
      <SaveDashboardAsForm
        dashboard={dashboard}
        changeInfo={{ isNew: true, changedSaveModel: { title: 'Test dashboard' } } as DashboardChangeInfo}
        drawer={drawer}
      />
    );

    return { dashboard };
  }

  it('applies the picked folder manager annotations on a normal save as', async () => {
    const { dashboard } = setup();

    await userEvent.click(screen.getByText('Pick repo folder'));

    await waitFor(() => expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyManagerIdentity]).toBe('my-repo'));
  });

  it('leaves the dashboard unmanaged when the database escape hatch picks a provisioned folder', async () => {
    const { dashboard } = setup(true);

    await userEvent.click(screen.getByText('Pick repo folder'));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBe('repo-folder'));
    // Left in place, saveCompleted would mark the saved database dashboard as repo-managed
    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyManagerIdentity]).toBeUndefined();
    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyManagerKind]).toBeUndefined();
  });

  it('renames the folder along with the uid, so the diff tab and a remounted picker agree', async () => {
    const { dashboard } = setup(undefined, { folderUid: 'old-folder', folderTitle: 'Old Folder' });

    await userEvent.click(screen.getByText('Pick repo folder'));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBe('repo-folder'));
    expect(dashboard.state.meta.folderTitle).toBe('Repo Folder');
  });

  it('keeps the last picked folder when an earlier pick resolves after it', async () => {
    let resolveSlow: (meta: ProvisionedMeta) => void = () => {};
    const slowMeta = new Promise<ProvisionedMeta>((resolve) => {
      resolveSlow = resolve;
    });
    jest
      .mocked(getProvisionedMeta)
      .mockImplementationOnce(() => slowMeta)
      .mockResolvedValueOnce({
        k8s: { annotations: { [AnnoKeyManagerIdentity]: 'fast-repo', [AnnoKeyManagerKind]: ManagerKind.Repo } },
      });

    const { dashboard } = setup();

    await userEvent.click(screen.getByText('Pick repo folder'));
    await userEvent.click(screen.getByText('Pick other folder'));

    await waitFor(() => expect(dashboard.state.meta.folderUid).toBe('other-folder'));

    resolveSlow({
      k8s: { annotations: { [AnnoKeyManagerIdentity]: 'slow-repo', [AnnoKeyManagerKind]: ManagerKind.Repo } },
    });
    // The picker's own continuation is queued first, so it has run by the time this resolves
    await slowMeta;

    expect(dashboard.state.meta.folderUid).toBe('other-folder');
    expect(dashboard.state.meta.folderTitle).toBe('Other Folder');
    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyManagerIdentity]).toBe('fast-repo');
  });
});
