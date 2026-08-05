/**
 * CREATE_NOTEBOOK_SPEC: the one command here that writes a resource rather than a scene.
 *
 * The request itself is mocked. What is worth pinning is everything around it: that it validates
 * before writing, navigates to what the server named, and runs from a dashboard page, since creating
 * the first notebook is the case that cannot require a notebook to be open already.
 */

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { createNotebook } from 'app/features/notebook/api/notebookResource';
import { AccessControlAction } from 'app/types/accessControl';

import { type DashboardScene } from '../../scene/DashboardScene';

import { createNotebookSpecCommand } from './createNotebookSpec';
import { cell, contextFor, makeNotebookSpec, stubDashboardScene } from './test-utils';

jest.mock('app/features/notebook/api/notebookResource', () => ({
  createNotebook: jest.fn(),
}));

let notebooksFlagEnabled = true;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => notebooksFlagEnabled }),
}));

beforeEach(() => {
  notebooksFlagEnabled = true;
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CREATE_NOTEBOOK_SPEC', () => {
  const createNotebookMock = jest.mocked(createNotebook);

  /** A dashboard scene: where a create is realistically called from. */
  function dashboardScene(): DashboardScene {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the create handler never reads the scene
    return { state: { body: { descriptor: { id: 'GridLayout' } }, meta: {} } } as unknown as DashboardScene;
  }

  async function createNotebookSpec(spec: unknown, overrides: { validate?: boolean; open?: boolean } = {}) {
    return createNotebookSpecCommand.handler(
      { spec: spec as Record<string, unknown>, validate: true, open: true, ...overrides },
      contextFor(dashboardScene())
    );
  }

  beforeEach(() => {
    createNotebookMock.mockReset();
    createNotebookMock.mockResolvedValue({ uid: 'n-abc123', url: '/notebook/n-abc123' });
  });

  it('writes the spec and navigates to the uid the server assigned', async () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});

    const result = await createNotebookSpec(makeNotebookSpec());

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ created: true, uid: 'n-abc123', url: '/notebook/n-abc123' });
    expect(push).toHaveBeenCalledWith('/notebook/n-abc123');
  });

  it('creates without navigating when the caller asks to stay', async () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});

    expect((await createNotebookSpec(makeNotebookSpec(), { open: false })).success).toBe(true);

    expect(createNotebookMock).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  // Validation defaults on here and off everywhere else, because this write is persisted: an invalid
  // spec applied to a scene is a bad render the user can walk away from, and an invalid spec created
  // is a resource that stays broken.
  it('rejects a dangling cell reference before writing anything', async () => {
    const spec = makeNotebookSpec();

    const result = await createNotebookSpec({
      ...spec,
      layout: { kind: 'NotebookLayout', spec: { cells: [...spec.layout.spec.cells, cell('ghost', 'assistant')] } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no element named "ghost"');
    expect(createNotebookMock).not.toHaveBeenCalled();
  });

  it('reports what the apiserver rejected, so the caller can correct the spec', async () => {
    createNotebookMock.mockRejectedValue(new Error('Notebook.spec.layout: unsupported layout kind'));

    const result = await createNotebookSpec(makeNotebookSpec());

    expect(result.success).toBe(false);
    expect(result.error).toContain('unsupported layout kind');
  });

  describe('permission', () => {
    it('allows a create from a dashboard page, where no notebook is open', () => {
      expect(createNotebookSpecCommand.permission(dashboardScene())).toEqual({ allowed: true });
    });

    it('refuses when the notebooks feature flag is off', () => {
      notebooksFlagEnabled = false;

      const result = createNotebookSpecCommand.permission(dashboardScene());
      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.error).toContain('dashboard.notebooks');
    });

    // Creating is a different action from editing: a user who may edit the dashboards they own is
    // not necessarily allowed to add new documents.
    it('refuses when the user cannot create dashboards', () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action !== AccessControlAction.DashboardsCreate);

      const result = createNotebookSpecCommand.permission(dashboardScene());
      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.error).toContain('insufficient permissions');
    });
  });
});
