import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import {
  persistUseCrossDashboardVariables,
  parseUseCrossDashboardVariablesFromHost,
  type CrossDashboardVariablesHost,
} from './persistUseCrossDashboardVariables';

function createHost(annotations: Record<string, string> = {}): CrossDashboardVariablesHost {
  const meta = {
    k8s: { annotations: { ...annotations } },
  };

  return {
    state: { meta },
    setState: (next) => {
      Object.assign(meta, next.meta ?? {});
    },
    serializer: {
      getK8SMetadata: () => ({ annotations: { ...meta.k8s?.annotations } }),
      setK8SAnnotations: jest.fn((next) => {
        meta.k8s = { ...(meta.k8s ?? {}), annotations: next };
      }),
    },
    refreshPredefinedVariables: jest.fn().mockResolvedValue(undefined),
  };
}

describe('persistUseCrossDashboardVariables', () => {
  it('writes the annotation and refreshes injected variables', async () => {
    const host = createHost();

    await persistUseCrossDashboardVariables(host, { global: 'all', folder: 'none' });

    expect(host.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":"all","folder":"none"}'
    );
    expect(parseUseCrossDashboardVariablesFromHost(host)).toEqual({ global: 'all', folder: 'none' });
    expect(host.refreshPredefinedVariables).toHaveBeenCalled();
  });

  it('omits the annotation when both scopes are none', async () => {
    const host = createHost({
      [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}',
    });

    await persistUseCrossDashboardVariables(host, { global: 'none', folder: 'none' });

    expect(host.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBeUndefined();
    expect(parseUseCrossDashboardVariablesFromHost(host)).toBeUndefined();
  });
});
