import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { type LibraryPanel } from '@grafana/schema';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { setupProvisioningMswServer } from 'app/features/provisioning/mocks/server';

import { LibraryPanelsPage } from '../LibraryPanelsPage';
import * as api from '../state/api';

import { AddLibraryPanelContents } from './AddLibraryPanelModal/AddLibraryPanelModal';
import { DeleteLibraryPanelModal } from './DeleteLibraryPanelModal/DeleteLibraryPanelModal';
import { LibraryPanelCard } from './LibraryPanelCard/LibraryPanelCard';
import { SaveProvisionedLibraryPanelDrawer } from './SaveProvisionedLibraryPanelDrawer';

setupProvisioningMswServer();

const navigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => navigate,
}));
jest.mock('app/features/provisioning/hooks/usePRBranch', () => ({ usePRBranch: jest.fn(() => undefined) }));

const panel: LibraryPanel = {
  uid: 'cpu',
  name: 'CPU',
  type: 'text',
  version: 1,
  model: { type: 'text', title: 'CPU usage', transformations: [{ id: 'reduce', options: {} }] },
  metadata: {
    name: 'cpu',
    annotations: {
      'grafana.app/managedBy': 'repo',
      'grafana.app/managerId': 'panels',
      'grafana.app/sourcePath': 'cpu.json',
    },
  },
};
const repository = {
  name: 'panels',
  title: 'Panel repository',
  type: 'github',
  target: 'folder',
  branch: 'main',
  workflows: ['write'],
  url: 'https://github.com/example/panels',
};

function settings({ disabled = false, workflows = ['write'] }: { disabled?: boolean; workflows?: string[] } = {}) {
  server.use(
    http.get(`${BASE}/settings`, () =>
      HttpResponse.json({
        items: [{ ...repository, workflows }],
        availableResources: [{ group: 'dashboard.grafana.app', kind: 'LibraryPanel', disabled }],
      })
    )
  );
}

async function selectRepository(user: ReturnType<typeof render>['user']) {
  await user.click(await screen.findByRole('combobox', { name: /Repository/ }));
  await user.keyboard('{ArrowDown}{Enter}');
}

function disableK8sClient() {
  setTestFlags({ [FlagKeys.LibraryelementsKubernetesLibraryPanels]: false });
}

let writes: Array<{ method: string; path: string; body?: unknown }>;
let responseRef: string | undefined;
const provisioningEnabled = config.provisioningEnabled;

beforeEach(() => {
  writes = [];
  responseRef = undefined;
  navigate.mockClear();
  config.provisioningEnabled = true;
  setTestFlags({ [FlagKeys.LibraryelementsKubernetesLibraryPanels]: true });
  jest.spyOn(api, 'getLibraryPanelByName').mockResolvedValue([]);
  jest.spyOn(api, 'addLibraryPanel').mockResolvedValue(panel);
  jest.spyOn(api, 'getConnectedDashboards').mockResolvedValue(null);
  settings();
  server.use(
    http.get('/apis', () =>
      HttpResponse.json({
        items: [
          {
            metadata: { name: 'dashboard.grafana.app' },
            versions: [
              {
                version: 'v0alpha1',
                resources: [
                  {
                    resource: 'librarypanels',
                    responseKind: { group: 'dashboard.grafana.app', version: 'v0alpha1', kind: 'LibraryPanel' },
                    verbs: ['get', 'list', 'create', 'update', 'delete'],
                  },
                ],
              },
            ],
          },
        ],
      })
    ),
    http.all(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
      writes.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: request.method === 'DELETE' ? undefined : await request.json(),
      });
      return HttpResponse.json({
        path: 'cpu.json',
        ref: responseRef,
        resource: { upsert: {} },
        urls: {
          newPullRequestURL: 'https://github.com/example/panels/compare/main...change',
        },
      });
    })
  );
});

afterEach(() => {
  jest.restoreAllMocks();
  setTestFlags({});
  config.provisioningEnabled = provisioningEnabled;
});

it('commits extra panel settings in status.missing when updating through Git', async () => {
  const onWriteSuccess = jest.fn();
  const onDismiss = jest.fn();
  const { user } = render(
    <SaveProvisionedLibraryPanelDrawer
      action="update"
      panel={panel}
      onWriteSuccess={onWriteSuccess}
      onDismiss={onDismiss}
    />
  );
  await user.click(await screen.findByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onWriteSuccess).toHaveBeenCalledTimes(1));
  expect(writes).toEqual([
    {
      method: 'PUT',
      path: expect.stringMatching(/\/files\/cpu\.json$/),
      body: {
        apiVersion: 'dashboard.grafana.app/v0alpha1',
        kind: 'LibraryPanel',
        metadata: { name: 'cpu' },
        spec: { title: 'CPU', panelTitle: 'CPU usage', type: 'text', options: {}, fieldConfig: {} },
        status: { missing: { transformations: [{ id: 'reduce', options: {} }] } },
      },
    },
  ]);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('keeps an unmanaged creation on the existing Grafana API path', async () => {
  const onCreated = jest.fn();
  const { user } = render(
    <AddLibraryPanelContents panel={new PanelModel({ title: 'CPU', type: 'text' })} onCreateLibraryPanel={onCreated} />
  );
  const create = await screen.findByRole('button', { name: 'Create library panel' });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(panel));
  expect(api.addLibraryPanel).toHaveBeenCalledTimes(1);
  expect(writes).toEqual([]);
});

it('creates in the selected repository and links the dashboard panel to the committed one', async () => {
  const onCreated = jest.fn();
  const onDismiss = jest.fn();
  const { user } = render(
    <AddLibraryPanelContents
      panel={new PanelModel({ title: 'CPU', type: 'text' })}
      onCreateLibraryPanel={onCreated}
      onDismiss={onDismiss}
    />
  );
  await selectRepository(user);
  await user.click(screen.getByRole('button', { name: 'Create library panel' }));
  expect(await screen.findByRole('heading', { name: 'Save provisioned library panel' })).toBeInTheDocument();
  expect(onCreated).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  expect(writes.map((write) => write.method)).toEqual(['POST']);
  expect(onCreated).toHaveBeenCalledWith(
    expect.objectContaining({ uid: (writes[0].body as { metadata: { name: string } }).metadata.name, name: 'CPU' })
  );
  expect(onDismiss).toHaveBeenCalled();
  expect(api.addLibraryPanel).not.toHaveBeenCalled();
});

it('cancels repository creation without linking or changing the original panel', async () => {
  const model = new PanelModel({ title: 'CPU', type: 'text' });
  const onCreated = jest.fn();
  const { user } = render(<AddLibraryPanelContents panel={model} onCreateLibraryPanel={onCreated} />);
  await selectRepository(user);
  await user.click(screen.getByRole('button', { name: 'Create library panel' }));
  const drawer = await screen.findByRole('dialog', { name: /Save provisioned library panel/ });
  await user.click(within(drawer).getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Save provisioned library panel' })).not.toBeInTheDocument()
  );
  expect(model.libraryPanel).toBeUndefined();
  expect(onCreated).not.toHaveBeenCalled();
  expect(writes).toEqual([]);
});

it('omits repeated panel scoped variables from the Git create request', async () => {
  const model = new PanelModel({
    title: 'CPU',
    type: 'text',
    scopedVars: { host: { text: 'host-a', value: 'host-a' } },
  });
  const { user } = render(<AddLibraryPanelContents panel={model} />);
  await selectRepository(user);
  await user.click(screen.getByRole('button', { name: 'Create library panel' }));
  await user.click(await screen.findByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).not.toHaveProperty('status.missing.scopedVars');
});

it('does not apply the folder name check to a repository create', async () => {
  jest.mocked(api.getLibraryPanelByName).mockResolvedValue([panel]);
  const { user } = render(<AddLibraryPanelContents panel={new PanelModel({ title: 'CPU', type: 'text' })} />);
  expect(await screen.findByText('Library panel with this name already exists')).toBeInTheDocument();
  await selectRepository(user);
  expect(screen.queryByText('Library panel with this name already exists')).not.toBeInTheDocument();
  expect(screen.queryByText('Save in folder')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create library panel' })).toBeEnabled();
});

it.each([
  {
    gate: 'provisioning disabled',
    setup: () => {
      config.provisioningEnabled = false;
    },
  },
  { gate: 'kind disabled', setup: () => settings({ disabled: true }) },
  { gate: 'client disabled', setup: disableK8sClient },
])('does not offer repository creation with $gate', async ({ setup }) => {
  setup();
  const onCreated = jest.fn();
  const { user } = render(
    <AddLibraryPanelContents panel={new PanelModel({ title: 'CPU', type: 'text' })} onCreateLibraryPanel={onCreated} />
  );
  const create = await screen.findByRole('button', { name: 'Create library panel' });
  await waitFor(() => expect(create).toBeEnabled());
  await user.click(create);
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(panel));
  expect(screen.queryByRole('combobox', { name: /Repository/ })).not.toBeInTheDocument();
  expect(writes).toEqual([]);
});

it('opens a managed card source menu without selecting the panel', async () => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.replaceProperty(contextSrv, 'isEditor', true);
  const onClick = jest.fn();
  const { user } = render(<LibraryPanelCard libraryPanel={panel} onClick={onClick} />);
  await user.click(await screen.findByRole('button', { name: 'Managed by: Repository Panel repository' }));
  expect(await screen.findByRole('menuitem', { name: 'View source file' })).toHaveAttribute(
    'href',
    'https://github.com/example/panels/blob/main/cpu.json'
  );
  expect(onClick).not.toHaveBeenCalled();
});

it('shows the pull-request banner on the library collection page', async () => {
  jest.spyOn(api, 'getLibraryPanels').mockResolvedValue({ elements: [], totalCount: 0, page: 1, perPage: 40 });
  render(<LibraryPanelsPage />, {
    historyOptions: {
      initialEntries: [
        '/library-panels?new_pull_request_url=https%3A%2F%2Fgithub.com%2Fexample%2Fpanels%2Fcompare%2Fchange&repo_type=github&action=create&ref=change&repo_branch=main',
      ],
    },
  });
  expect(await screen.findByRole('link', { name: /pull request/i })).toHaveAttribute(
    'href',
    'https://github.com/example/panels/compare/change'
  );
  expect(await screen.findByText("You haven't created any library panels yet")).toBeInTheDocument();
});

it('returns a branch creation to the library page with PR parameters without linking the panel', async () => {
  settings({ workflows: ['branch'] });
  responseRef = 'change';
  const onWriteSuccess = jest.fn();
  const { user } = render(
    <SaveProvisionedLibraryPanelDrawer
      action="create"
      repositoryName="panels"
      panel={{ ...panel, metadata: undefined }}
      onWriteSuccess={onWriteSuccess}
      onDismiss={jest.fn()}
    />
  );
  await user.click(await screen.findByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  const destination = new URL(navigate.mock.calls[0][0], 'http://localhost');
  expect(destination.pathname).toBe('/library-panels');
  expect(destination.searchParams.get('new_pull_request_url')).toBe(
    'https://github.com/example/panels/compare/main...change'
  );
  expect(destination.searchParams.get('action')).toBe('create');
  expect(onWriteSuccess).not.toHaveBeenCalled();
});

it('marks a branch update saved before redirecting to the pull-request banner', async () => {
  settings({ workflows: ['branch'] });
  responseRef = 'change';
  const onBranchSaved = jest.fn(() => expect(navigate).not.toHaveBeenCalled());
  const { user } = render(
    <SaveProvisionedLibraryPanelDrawer
      action="update"
      panel={panel}
      onBranchSaved={onBranchSaved}
      onDismiss={jest.fn()}
    />
  );
  await user.click(await screen.findByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(onBranchSaved).toHaveBeenCalledTimes(1);
  expect(new URL(navigate.mock.calls[0][0], 'http://localhost').searchParams.get('action')).toBe('update');
});

it('prevents deletion while the panel is connected to a dashboard', async () => {
  jest.mocked(api.getConnectedDashboards).mockResolvedValue([
    {
      uid: 'dash',
      name: 'Production',
      kind: 'dashboard',
      url: '/d/dash',
      panel_type: '',
      tags: [],
      location: '',
      ds_uid: [],
    },
  ]);
  const { user } = render(<DeleteLibraryPanelModal libraryPanel={panel} onConfirm={jest.fn()} onDismiss={jest.fn()} />);
  expect(await screen.findByText('Production')).toBeInTheDocument();
  const remove = screen.getByRole('button', { name: 'Delete' });
  expect(remove).toBeDisabled();
  await user.click(remove);
  expect(writes).toEqual([]);
});

it('deletes an unused repository-managed panel through Git and refreshes the list', async () => {
  const onConfirm = jest.fn();
  const onDeleted = jest.fn();
  const { user } = render(
    <DeleteLibraryPanelModal libraryPanel={panel} onConfirm={onConfirm} onDeleted={onDeleted} onDismiss={jest.fn()} />
  );
  const remove = await screen.findByRole('button', { name: 'Delete' });
  await waitFor(() => expect(remove).toBeEnabled());
  await user.click(remove);
  expect(await screen.findByRole('heading', { name: 'Delete provisioned library panel' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(writes).toEqual([{ method: 'DELETE', path: expect.stringMatching(/\/files\/cpu\.json$/), body: undefined }]);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('keeps deleting an unmanaged panel through the existing API path', async () => {
  const onConfirm = jest.fn();
  const { user } = render(
    <DeleteLibraryPanelModal
      libraryPanel={{ ...panel, metadata: undefined }}
      onConfirm={onConfirm}
      onDismiss={jest.fn()}
    />
  );
  const remove = await screen.findByRole('button', { name: 'Delete' });
  await waitFor(() => expect(remove).toBeEnabled());
  await user.click(remove);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(writes).toEqual([]);
});
