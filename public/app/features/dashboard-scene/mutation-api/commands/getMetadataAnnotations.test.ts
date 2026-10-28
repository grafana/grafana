import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import type { DashboardScene } from '../../scene/DashboardScene';

import { getMetadataAnnotationsCommand } from './getMetadataAnnotations';

function buildScene(annotations: Record<string, string> = {}): DashboardScene {
  const scene = {
    state: {
      meta: {
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

function requestUseCrossDashboardVariables() {
  return { annotations: [AnnoKeyUseCrossDashboardVariables] as [typeof AnnoKeyUseCrossDashboardVariables] };
}

describe('GET_METADATA_ANNOTATIONS', () => {
  afterEach(() => {
    setTestFlags({});
  });

  it('refuses when the feature toggle is off', () => {
    const result = getMetadataAnnotationsCommand.permission(buildScene());

    expect(result).toEqual({
      allowed: false,
      error: 'Cross-dashboard variables require the grafana.dashboardGlobalVariables feature toggle to be enabled.',
    });
  });

  it('returns null for grafana.app/useCrossDashboardVariables when the annotation is missing', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });

    const result = await getMetadataAnnotationsCommand.handler(requestUseCrossDashboardVariables(), {
      scene: buildScene(),
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: null },
    });
  });

  it('returns the parsed name-list selection', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });

    const result = await getMetadataAnnotationsCommand.handler(requestUseCrossDashboardVariables(), {
      scene: buildScene({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
      }),
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: { global: ['env'], folder: 'none' } },
    });
  });

  it('returns all/all when the annotation opts both scopes in', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGlobalVariables]: true });

    const result = await getMetadataAnnotationsCommand.handler(requestUseCrossDashboardVariables(), {
      scene: buildScene({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}',
      }),
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      annotations: { [AnnoKeyUseCrossDashboardVariables]: { global: 'all', folder: 'all' } },
    });
  });
});
