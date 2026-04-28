import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { RestoreModal, type RestoreModalProps } from './RestoreModal';

const [_, { folderA }] = getFolderFixtures();

const server = setupMockServer();
setBackendSrv(backendSrv);

// NestedFolderPicker (rendered via FolderPicker) calls useGetTeamFolders which hits
// team + dashboard-search APIs unrelated to RestoreModal. Mock it out with a static
// return value — same pattern as NestedFolderPicker.test.tsx.
jest.mock('app/core/components/NestedFolderPicker/useTeamOwnedFolder', () => {
  const actual = jest.requireActual('app/core/components/NestedFolderPicker/useTeamOwnedFolder');
  return {
    ...actual,
    useGetTeamFolders: jest.fn().mockReturnValue({
      foldersByTeam: [],
      isLoading: false,
      error: undefined,
    }),
  };
});

const onConfirm = jest.fn().mockResolvedValue(undefined);
const onDismiss = jest.fn();

describe('RestoreModal', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('preselects the root folder immediately without validating it', async () => {
    renderRestoreModal({ originCandidate: '' });

    // Root folder = "Dashboards" in the NestedFolderPicker trigger
    expect(await screen.findByRole('button', { name: /Dashboards currently selected/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('preselects a live origin folder after a successful validation lookup', async () => {
    renderRestoreModal({ originCandidate: folderA.item.uid });

    // MSW returns folder A → FolderPicker shows its title
    expect(
      await screen.findByRole('button', { name: new RegExp(`${folderA.item.title} currently selected`) })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('leaves the picker empty when the origin folder returns 404', async () => {
    // UID not in fixtures → default MSW handler returns 404
    renderRestoreModal({ originCandidate: 'deleted-folder' });

    // getAutoTarget returns undefined for 404 → no folder selected → Restore disabled
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });

  it('keeps the original folder selected when validation returns 403', async () => {
    // Override the folder handler to return 403 for all UIDs
    server.use(http.get('/api/folders/:uid', () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })));

    renderRestoreModal({ originCandidate: folderA.item.uid });

    // getAutoTarget returns originCandidate for non-404 errors → restoreTarget is set
    // The FolderPicker's own facade also gets 403, so it can't resolve the title.
    // But the Restore button should be enabled because restoreTarget !== undefined.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
    });
  });

  it('does not preselect while validation is in progress', async () => {
    // Keep the validation request pending indefinitely
    server.use(
      http.get('/api/folders/:uid', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      })
    );

    renderRestoreModal({ originCandidate: folderA.item.uid });

    // isFetching: true → autoTarget = undefined → FolderPicker has no value
    expect(await screen.findByRole('button', { name: 'Select folder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
  });

  it('preserves a manual folder selection when validation later succeeds', async () => {
    // Deferred response: validation stays pending until we resolve it
    let resolveValidation!: () => void;
    server.use(
      http.get('/api/folders/:uid', () => {
        return new Promise<Response>((resolve) => {
          resolveValidation = () =>
            resolve(
              HttpResponse.json({
                uid: folderA.item.uid,
                title: folderA.item.title,
              })
            );
        });
      })
    );

    const { user } = renderRestoreModal({ originCandidate: folderA.item.uid });

    // While validation is pending, picker has no value → user can pick manually
    const trigger = await screen.findByRole('button', { name: 'Select folder' });
    await user.click(trigger);

    // Folder list loads via default MSW handlers for /api/folders (list endpoint
    // is NOT overridden — only /api/folders/:uid is). The root "Dashboards" item
    // is always visible.
    const dashboardsItem = await screen.findByLabelText('Dashboards');
    await user.click(dashboardsItem);

    // Resolve validation — autoTarget becomes folderA.item.uid
    resolveValidation();

    // Manual selection (root = '') should be preserved over autoTarget
    expect(await screen.findByRole('button', { name: /Dashboards currently selected/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });
});

function renderRestoreModal(props: Partial<RestoreModalProps> = {}) {
  return render(
    <RestoreModal
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      selectedDashboards={['dashboard-1']}
      isLoading={false}
      {...props}
    />
  );
}
