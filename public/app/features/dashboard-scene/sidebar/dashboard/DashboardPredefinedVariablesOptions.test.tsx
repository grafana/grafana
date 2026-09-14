import { screen } from '@testing-library/react';
import { act, render } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { DashboardInteractions } from '../../utils/interactions';
import { toControlSourceRef } from '../../utils/predefinedVariables';

import {
  DashboardPredefinedVariablesOptions,
  updateDashboardScopeAll,
  updateDashboardScopeVariable,
  type PredefinedVariablesDashboard,
} from './DashboardPredefinedVariablesOptions';

const mockFetchPredefinedVariables = jest.fn();

jest.mock('../../utils/predefinedVariables', () => ({
  ...jest.requireActual('../../utils/predefinedVariables'),
  fetchPredefinedVariables: (...args: unknown[]) => mockFetchPredefinedVariables(...args),
}));

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => [{}, () => {}],
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useLocalStorage: () => [{ isExpanded: true }, () => {}],
}));

function createDashboard(annotations: Record<string, string> = {}): PredefinedVariablesDashboard {
  const meta = {
    canSave: true,
    folderUid: 'folder-1',
    k8s: { annotations: { ...annotations } },
  };

  return {
    state: {
      uid: 'dash-1',
      meta,
    },
    useState: () => ({ meta }),
    setState: jest.fn((next) => {
      Object.assign(meta, next.meta ?? {});
    }),
    serializer: {
      getK8SMetadata: () => ({ annotations: { ...meta.k8s?.annotations } }),
      setK8SAnnotations: jest.fn((next) => {
        meta.k8s = { ...(meta.k8s ?? {}), annotations: next };
      }),
    },
    refreshPredefinedVariables: jest.fn().mockResolvedValue(undefined),
    managedResourceCannotBeEdited: () => false,
  } as unknown as PredefinedVariablesDashboard;
}

function makeCandidate(name: string, origin: 'global' | 'folder'): VariableKind {
  return {
    kind: 'CustomVariable',
    spec: {
      ...defaultCustomVariableSpec(),
      name,
      origin: toControlSourceRef(origin === 'global' ? { type: 'global' } : { type: 'folder', folderUid: 'folder-1' }),
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('updateDashboardScopeVariable', () => {
  let toggledSpy: jest.SpyInstance;

  beforeEach(() => {
    toggledSpy = jest.spyOn(DashboardInteractions, 'predefinedVariableToggled').mockImplementation(() => undefined);
  });

  afterEach(() => {
    toggledSpy.mockRestore();
  });

  it('writes a name array when checking one global and reports toggle analytics', () => {
    const dashboard = createDashboard();

    updateDashboardScopeVariable(dashboard, 'global', 'env', true, ['region', 'env']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["env"],"folder":"none"}'
    );
    expect(toggledSpy).toHaveBeenCalledWith({ scope: 'global', checked: true });
    expect(dashboard.refreshPredefinedVariables).toHaveBeenCalled();
  });

  it('unchecking one name from all writes the remaining names', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
    });

    updateDashboardScopeVariable(dashboard, 'global', 'env', false, ['region', 'env']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["region"],"folder":"none"}'
    );
  });

  it('unchecking the last name omits the annotation', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
    });

    updateDashboardScopeVariable(dashboard, 'global', 'env', false, ['region', 'env']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
  });

  it('checking every listed name stays a name array instead of all', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":["region"],"folder":"none"}',
    });

    updateDashboardScopeVariable(dashboard, 'global', 'env', true, ['region', 'env']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["env","region"],"folder":"none"}'
    );
  });

  it('checking All writes all so auto-include can be restored', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
    });

    updateDashboardScopeAll(dashboard, 'global', true);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":"all","folder":"none"}'
    );
    expect(toggledSpy).toHaveBeenCalledWith({ scope: 'global', checked: true });
  });

  it('unchecking All clears the scope', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
    });

    updateDashboardScopeAll(dashboard, 'global', false);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
  });

  it('unchecking a reclassified folder name also drops it from global', () => {
    const dashboard = createDashboard({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
    });

    updateDashboardScopeVariable(dashboard, 'folder', 'env', false, ['env', 'cluster']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
  });

  it('drops grafana.app/ignorePredefinedVariables when persisting a selection', () => {
    // Older dashboards may still carry this unread denylist. Persist must delete it
    // or readAnnotationMap copies it into every later save.
    const dashboard = createDashboard({
      'grafana.app/ignorePredefinedVariables': 'global:*',
    });

    updateDashboardScopeVariable(dashboard, 'global', 'env', true, ['env']);

    expect(Object.keys(dashboard.state.meta.k8s?.annotations ?? {})).toEqual([AnnoKeyUseCrossDashboardVariables]);
    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["env"],"folder":"none"}'
    );
  });
});

describe('DashboardPredefinedVariablesOptions', () => {
  beforeAll(() => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
  });

  afterEach(() => {
    mockFetchPredefinedVariables.mockReset();
  });

  afterAll(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('shows checkboxes after a delayed list load without expanding Global or Folder', async () => {
    const fetch = deferred<VariableKind[] | null>();
    mockFetchPredefinedVariables.mockReturnValue(fetch.promise);

    render(<DashboardPredefinedVariablesOptions dashboard={createDashboard()} />);

    expect(screen.queryByRole('checkbox', { name: 'env' })).not.toBeInTheDocument();
    expect(screen.queryByText('No global variables in this organization.')).not.toBeInTheDocument();

    await act(async () => {
      fetch.resolve([makeCandidate('env', 'global'), makeCandidate('cluster', 'folder')]);
    });

    expect(await screen.findByRole('checkbox', { name: 'env' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'cluster' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'All global' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'All folder' })).toBeInTheDocument();
    expect(screen.getByText('env')).toBeVisible();
    expect(screen.getByText('cluster')).toBeVisible();
  });

  it('shows empty-state copy when Global and Folder have no variables', async () => {
    mockFetchPredefinedVariables.mockResolvedValue([]);

    render(<DashboardPredefinedVariablesOptions dashboard={createDashboard()} />);

    expect(await screen.findByText('No global variables in this organization.')).toBeVisible();
    expect(screen.getByText('No folder variables in this folder.')).toBeVisible();
  });

  it('shows a load error instead of the empty copy when the list fetch fails', async () => {
    mockFetchPredefinedVariables.mockResolvedValue(null);

    render(<DashboardPredefinedVariablesOptions dashboard={createDashboard()} />);

    expect(await screen.findByText('Could not load global and folder variables.')).toBeInTheDocument();
    expect(screen.queryByText('No global variables in this organization.')).not.toBeInTheDocument();
    expect(screen.queryByText('No folder variables in this folder.')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
