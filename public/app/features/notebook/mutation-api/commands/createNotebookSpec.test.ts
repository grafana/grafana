import { configureStore } from '@reduxjs/toolkit';
import { type UnknownAction } from 'redux';
import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

import { type BackendSrv, locationService, setBackendSrv } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';

import { notebookViewUrl } from '../../urls';
import { NotebookMutationClient } from '../NotebookMutationClient';
import { NOTEBOOKS_FLAG, markdownCell, notebookScene, notebookSpec } from '../test-utils';

// The create command dispatches its POST through the app store; route that dispatch to a test store
// carrying the dashboard v2beta1 API so the RTK mutation actually runs, exactly as the notebook page
// state manager's suite does.
const createTestStore = () =>
  configureStore({
    reducer: { [dashboardAPIv2beta1.reducerPath]: dashboardAPIv2beta1.reducer },
    // The dev-only serializable/immutable checks log on the error path (the rejected RTK action
    // carries an Error instance) and jest-fail-on-console turns that into a failure.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }).concat(dashboardAPIv2beta1.middleware),
  });

let testStore: ReturnType<typeof createTestStore>;

jest.mock('app/store/store', () => {
  const actual = jest.requireActual('app/store/store');
  return {
    ...actual,
    dispatch: jest.fn((action: UnknownAction) => (testStore ? testStore.dispatch(action) : action)),
  };
});

function createdNotebook(name = 'n-abc123') {
  return { apiVersion: 'dashboard.grafana.app/v2beta1', kind: 'Notebook', metadata: { name }, spec: notebookSpec() };
}

describe('CREATE_NOTEBOOK_SPEC', () => {
  beforeEach(() => {
    testStore = createTestStore();
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    // locationService is shared across the file, so a test that navigated leaves the next one already
    // standing where it expects to arrive — which is exactly what `opened` reads.
    locationService.push('/d/where-the-user-was');
  });

  afterEach(() => {
    setTestFlags({});
    jest.restoreAllMocks();
  });

  it('creates the notebook and navigates to the uid the apiserver assigned', async () => {
    const fetch = jest.fn().mockReturnValue(of(createFetchResponse(createdNotebook())));
    setBackendSrv({ fetch } as unknown as BackendSrv);
    const push = jest.spyOn(locationService, 'push');
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    // Through the route's own helper, not a literal. A literal here agrees with whatever the command
    // happens to build, which is how a create that navigated to a non-existent route stayed green.
    expect(result).toMatchObject({
      success: true,
      data: { created: true, opened: true, uid: 'n-abc123', url: notebookViewUrl('n-abc123') },
    });
    expect(push).toHaveBeenCalledWith(notebookViewUrl('n-abc123'));
    // generateName, not a client-invented uid: the apiserver appends the random suffix.
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', data: expect.objectContaining({ metadata: { generateName: 'n' } }) })
    );
  });

  it('does not navigate when open is false', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(createdNotebook()))),
    } as unknown as BackendSrv);
    const push = jest.spyOn(locationService, 'push');
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({
      type: 'CREATE_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec(), open: false },
    });

    expect(result).toMatchObject({ success: true, data: { created: true, opened: false } });
    expect(push).not.toHaveBeenCalled();
  });

  it('reports opened: false when something blocked the navigation', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse(createdNotebook()))),
    } as unknown as BackendSrv);
    // What a dirty dashboard's unsaved-changes prompt does: the push is issued and the location does
    // not move.
    jest.spyOn(locationService, 'push').mockImplementation(() => {});
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    // The notebook is saved, so this is a success — but GET_NOTEBOOK_SPEC and APPLY_NOTEBOOK_SPEC only
    // reach it once its page is mounted, and `opened` is how the caller knows they cannot yet.
    expect(result).toMatchObject({ success: true, data: { created: true, opened: false, uid: 'n-abc123' } });
  });

  it('validates before writing, by default', async () => {
    const fetch = jest.fn();
    setBackendSrv({ fetch } as unknown as BackendSrv);
    const client = new NotebookMutationClient(notebookScene());

    // A layout naming an element that is not there. Unlike the other commands this one persists, so
    // it must not reach the apiserver.
    const result = await client.execute({
      type: 'CREATE_NOTEBOOK_SPEC',
      payload: { spec: notebookSpec({ elements: { intro: markdownCell('hi') }, cells: ['intro', 'ghost'] }) },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no element named "ghost"');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces the apiserver's own rejection message", async () => {
    setBackendSrv({
      fetch: jest
        .fn()
        .mockReturnValue(throwError(() => ({ status: 400, data: { message: 'spec.layout: unsupported kind' } }))),
    } as unknown as BackendSrv);
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    // Without this a caller only learns that something failed, and cannot correct the spec.
    expect(result).toMatchObject({ success: false, error: 'spec.layout: unsupported kind' });
  });

  it('fails clearly when the response carries no name', async () => {
    setBackendSrv({
      fetch: jest.fn().mockReturnValue(of(createFetchResponse({ ...createdNotebook(), metadata: {} }))),
    } as unknown as BackendSrv);
    const push = jest.spyOn(locationService, 'push');
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    // The uid is the apiserver's to assign, so there is nothing to navigate to and nothing to invent.
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('carried no name') });
    expect(push).not.toHaveBeenCalled();
  });

  it('is refused without dashboard create permission', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    const fetch = jest.fn();
    setBackendSrv({ fetch } as unknown as BackendSrv);
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot create notebook');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is refused when notebooks are not enabled', async () => {
    setTestFlags({ [NOTEBOOKS_FLAG]: false });
    const fetch = jest.fn();
    setBackendSrv({ fetch } as unknown as BackendSrv);
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'CREATE_NOTEBOOK_SPEC', payload: { spec: notebookSpec() } });

    expect(result.success).toBe(false);
    expect(result.error).toContain('dashboard.notebooks');
    expect(fetch).not.toHaveBeenCalled();
  });
});
