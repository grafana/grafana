import { config } from '@grafana/runtime';
import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable } from 'app/api/clients/dashboard/v2beta1';
import { buildVariableResource } from 'app/features/variables-management/utils';

import {
  clearPredefinedVariablesCache,
  fetchPredefinedVariables,
  isPredefinedOrigin,
  toControlSourceRef,
} from './predefinedVariables';

const mockGet = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: mockGet }),
}));

function makeVariable(name: string, folderUid?: string): Variable {
  const kind: VariableKind = {
    kind: 'CustomVariable',
    spec: { ...defaultCustomVariableSpec(), name, query: 'a,b,c' },
  };
  return buildVariableResource(kind, folderUid);
}

function mockListResponses({ global = [], folder = [] }: { global?: Variable[]; folder?: Variable[] }) {
  mockGet.mockImplementation(async (_url: string, params: { labelSelector: string }) => {
    if (params.labelSelector.startsWith('!')) {
      return { items: global, metadata: {} };
    }
    return { items: folder, metadata: {} };
  });
}

describe('fetchPredefinedVariables', () => {
  const originalToggle = config.featureToggles.globalDashboardVariables;

  beforeEach(() => {
    jest.clearAllMocks();
    clearPredefinedVariablesCache();
    config.featureToggles.globalDashboardVariables = true;
  });

  afterAll(() => {
    config.featureToggles.globalDashboardVariables = originalToggle;
  });

  it('returns an empty list without fetching when the feature toggle is off', async () => {
    config.featureToggles.globalDashboardVariables = false;

    const result = await fetchPredefinedVariables('folder-1');

    expect(result).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches only global variables when no folder uid is given', async () => {
    mockListResponses({ global: [makeVariable('region')] });

    const result = await fetchPredefinedVariables();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][1]).toMatchObject({ labelSelector: '!grafana.app/folder' });
    expect(result).toHaveLength(1);
    expect(result[0].spec.name).toBe('region');
    expect(result[0].spec.origin).toEqual({ type: 'global' });
  });

  it('fetches global and folder variables and tags each with its origin', async () => {
    mockListResponses({
      global: [makeVariable('region')],
      folder: [makeVariable('cluster', 'folder-1')],
    });

    const result = await fetchPredefinedVariables('folder-1');

    expect(mockGet).toHaveBeenCalledTimes(2);
    const selectors = mockGet.mock.calls.map((call) => call[1].labelSelector);
    expect(selectors).toEqual(expect.arrayContaining(['!grafana.app/folder', 'grafana.app/folder=folder-1']));

    // Hierarchy order: global, then folder-scoped.
    expect(result.map((v) => v.spec.name)).toEqual(['region', 'cluster']);
    expect(result[0].spec.origin).toEqual({ type: 'global' });
    expect(result[1].spec.origin).toEqual({ type: 'folder', folderUid: 'folder-1' });
  });

  it('drops global variables shadowed by a folder variable of the same name', async () => {
    mockListResponses({
      global: [makeVariable('region'), makeVariable('cluster')],
      folder: [makeVariable('cluster', 'folder-1')],
    });

    const result = await fetchPredefinedVariables('folder-1');

    expect(result.map((v) => v.spec.name)).toEqual(['region', 'cluster']);
    expect(result[1].spec.origin).toEqual({ type: 'folder', folderUid: 'folder-1' });
  });

  it('fails open and returns an empty list when the fetch errors', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGet.mockRejectedValue(new Error('boom'));

    const result = await fetchPredefinedVariables('folder-1');

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('serves repeat calls for the same folder from cache', async () => {
    mockListResponses({ global: [makeVariable('region')] });

    await fetchPredefinedVariables();
    await fetchPredefinedVariables();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('pages through list responses using continue tokens', async () => {
    const pageOne = makeVariable('one');
    const pageTwo = makeVariable('two');
    mockGet.mockImplementation(async (_url: string, params: { labelSelector: string; continue?: string }) => {
      if (params.continue) {
        return { items: [pageTwo], metadata: {} };
      }
      return { items: [pageOne], metadata: { continue: 'next-token' } };
    });

    const result = await fetchPredefinedVariables();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.map((v) => v.spec.name)).toEqual(['one', 'two']);
  });
});

describe('isPredefinedOrigin', () => {
  it('recognizes global and folder origins', () => {
    expect(isPredefinedOrigin(toControlSourceRef({ type: 'global' }))).toBe(true);
    expect(isPredefinedOrigin(toControlSourceRef({ type: 'folder', folderUid: 'f1' }))).toBe(true);
  });

  it('rejects datasource origins and empty values', () => {
    expect(isPredefinedOrigin({ type: 'datasource', group: 'prometheus' })).toBe(false);
    expect(isPredefinedOrigin(undefined)).toBe(false);
    expect(isPredefinedOrigin(null)).toBe(false);
  });
});
