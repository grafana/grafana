import { iamAPIv0alpha1, type Display, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import { type DashboardDataDTO } from 'app/types/dashboard';
import { dispatch } from 'app/types/store';

import { AnnoKeyUpdatedBy, type Resource, type ResourceList } from '../../apiserver/types';

import { resolveDeletedByDisplayMap } from './deletedDashboardsCache';

jest.mock('app/api/clients/iam/v0alpha1', () => ({
  iamAPIv0alpha1: {
    endpoints: {
      getDisplayMapping: {
        initiate: jest.fn(),
      },
    },
  },
}));

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  dispatch: jest.fn(),
}));

const mockInitiate = iamAPIv0alpha1.endpoints.getDisplayMapping.initiate as unknown as jest.Mock;
const mockDispatch = dispatch as unknown as jest.Mock;

function makeItem(name: string, deletedByUid?: string): Resource<DashboardDataDTO> {
  const annotations: Record<string, string> = {};
  if (deletedByUid !== undefined) {
    annotations[AnnoKeyUpdatedBy] = deletedByUid;
  }
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'Dashboard',
    metadata: {
      name,
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      deletionTimestamp: '2024-06-01T00:00:00Z',
      annotations,
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: { title: name, uid: name } as DashboardDataDTO,
  };
}

function makeResourceList(items: Array<Resource<DashboardDataDTO>>): ResourceList<DashboardDataDTO> {
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'DashboardList',
    metadata: { resourceVersion: '0' },
    items,
  };
}

function makeDisplayList(display: Display[]): DisplayList {
  return {
    display,
    keys: display.map((d) => `${d.identity.type}:${d.identity.name}`),
    metadata: {},
  };
}

describe('resolveDeletedByDisplayMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitiate.mockReturnValue('initiate-thunk');
  });

  it('returns undefined and does not dispatch when the list is empty', async () => {
    const map = await resolveDeletedByDisplayMap(makeResourceList([]));

    expect(map).toBeUndefined();
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns undefined and does not dispatch when no item has an updatedBy annotation', async () => {
    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a'), makeItem('b')]));

    expect(map).toBeUndefined();
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches getDisplayMapping with deduplicated UIDs', async () => {
    mockDispatch.mockResolvedValue({ data: makeDisplayList([]) });

    await resolveDeletedByDisplayMap(
      makeResourceList([
        makeItem('a', 'user:alice'),
        makeItem('b', 'user:alice'), // duplicate UID
        makeItem('c', 'user:bob'),
        makeItem('d'), // no annotation
      ])
    );

    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith('initiate-thunk');
    const keys = (mockInitiate.mock.calls[0][0] as { key: string[] }).key.slice().sort();
    expect(keys).toEqual(['user:alice', 'user:bob']);
  });

  it('builds a map keyed by identity `type:name`', async () => {
    mockDispatch.mockResolvedValue({
      data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]),
    });

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.size).toBe(1);
  });

  it('additionally keys the map by String(internalId) when provided', async () => {
    mockDispatch.mockResolvedValue({
      data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice', internalId: 42 }]),
    });

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.get('42')).toBe('Alice');
    expect(map?.get('user:42')).toBe('Alice');
  });

  it('aliases typed numeric annotations to the canonical entry via `<type>:<internalId>`', async () => {
    // Simulates the case where the annotation is `user:1` but the server
    // canonicalizes to `user:u000000001` plus `internalId: 1`.
    mockDispatch.mockResolvedValue({
      data: makeDisplayList([{ identity: { type: 'user', name: 'u000000001' }, displayName: 'Alice', internalId: 1 }]),
    });

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:1')]));

    expect(map?.get('user:1')).toBe('Alice');
    expect(map?.get('user:u000000001')).toBe('Alice');
    expect(map?.get('1')).toBe('Alice');
  });

  it('preserves Unicode display names verbatim', async () => {
    mockDispatch.mockResolvedValue({
      data: makeDisplayList([
        { identity: { type: 'user', name: 'tanaka' }, displayName: '田中太郎' },
        { identity: { type: 'user', name: 'mohamed' }, displayName: 'محمد العربي' },
      ]),
    });

    const map = await resolveDeletedByDisplayMap(
      makeResourceList([makeItem('a', 'user:tanaka'), makeItem('b', 'user:mohamed')])
    );

    expect(map?.get('user:tanaka')).toBe('田中太郎');
    expect(map?.get('user:mohamed')).toBe('محمد العربي');
  });

  it('omits entries for UIDs the server could not resolve', async () => {
    mockDispatch.mockResolvedValue({
      data: makeDisplayList([{ identity: { type: 'user', name: 'alice' }, displayName: 'Alice' }]),
    });

    const map = await resolveDeletedByDisplayMap(
      makeResourceList([makeItem('a', 'user:alice'), makeItem('b', 'user:missing')])
    );

    expect(map?.get('user:alice')).toBe('Alice');
    expect(map?.has('user:missing')).toBe(false);
  });

  it('returns undefined when the dispatch resolves with no data', async () => {
    mockDispatch.mockResolvedValue({ data: undefined });

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map).toBeUndefined();
  });

  it('returns undefined and swallows errors when the dispatch rejects', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDispatch.mockRejectedValue(new Error('boom'));

    const map = await resolveDeletedByDisplayMap(makeResourceList([makeItem('a', 'user:alice')]));

    expect(map).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
