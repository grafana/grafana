import { FlagKeys } from '@grafana/runtime/internal';
import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import type { DashboardScene } from '../../scene/DashboardScene';
import { toControlSourceRef } from '../../utils/predefinedVariables';

import { getCrossDashboardVariablesCommand } from './getCrossDashboardVariables';

const mockFetchPredefinedVariables = jest.fn();

jest.mock('../../utils/predefinedVariables', () => ({
  ...jest.requireActual('../../utils/predefinedVariables'),
  fetchPredefinedVariables: (...args: unknown[]) => mockFetchPredefinedVariables(...args),
}));

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

function buildScene(annotations: Record<string, string> = {}): DashboardScene {
  const scene = {
    state: {
      meta: {
        folderUid: 'folder-1',
        k8s: { annotations: { ...annotations } },
      },
    },
    serializer: {
      getK8SMetadata: () => ({ annotations: { ...annotations } }),
      setK8SAnnotations: jest.fn(),
    },
  };
  return scene as unknown as DashboardScene;
}

describe('GET_CROSS_DASHBOARD_VARIABLES', () => {
  afterEach(() => {
    mockFetchPredefinedVariables.mockReset();
    setTestFlags({});
  });

  it('refuses when the feature toggle is off', () => {
    const result = getCrossDashboardVariablesCommand.permission(buildScene());

    expect(result).toEqual({
      allowed: false,
      error: 'Cross-dashboard variables require the grafana.dashboardGlobalVariables feature toggle to be enabled.',
    });
  });

  it('returns undefined selection and available names when the annotation is missing', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    mockFetchPredefinedVariables.mockResolvedValue([makeCandidate('env', 'global'), makeCandidate('cluster', 'folder')]);

    const result = await getCrossDashboardVariablesCommand.handler({}, { scene: buildScene() });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      selection: undefined,
      available: { global: ['env'], folder: ['cluster'] },
    });
    expect(mockFetchPredefinedVariables).toHaveBeenCalledWith('folder-1');
  });

  it('returns the parsed name-list selection', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    mockFetchPredefinedVariables.mockResolvedValue([makeCandidate('env', 'global')]);

    const result = await getCrossDashboardVariablesCommand.handler(
      {},
      {
        scene: buildScene({
          [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
        }),
      }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      selection: { global: ['env'], folder: 'none' },
      available: { global: ['env'], folder: [] },
    });
  });

  it('returns all/all when the annotation opts both scopes in', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    mockFetchPredefinedVariables.mockResolvedValue([]);

    const result = await getCrossDashboardVariablesCommand.handler(
      {},
      {
        scene: buildScene({
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}',
        }),
      }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      selection: { global: 'all', folder: 'all' },
      available: { global: [], folder: [] },
    });
  });

  it('warns and returns empty available names when the list fetch fails', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });
    mockFetchPredefinedVariables.mockResolvedValue(null);

    const result = await getCrossDashboardVariablesCommand.handler(
      {},
      {
        scene: buildScene({
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
        }),
      }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      selection: { global: 'all', folder: 'none' },
      available: { global: [], folder: [] },
    });
    expect(result.warnings).toEqual(['Could not load global and folder variables']);
  });
});
