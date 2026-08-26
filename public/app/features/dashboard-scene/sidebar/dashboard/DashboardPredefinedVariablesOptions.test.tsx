import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { DashboardInteractions } from '../../utils/interactions';

import { updateDashboardScopeVariable, type PredefinedVariablesDashboard } from './DashboardPredefinedVariablesOptions';

describe('updateDashboardScopeVariable', () => {
  let modeChangedSpy: jest.SpyInstance;

  beforeEach(() => {
    modeChangedSpy = jest
      .spyOn(DashboardInteractions, 'globalVariablesModeChanged')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    modeChangedSpy.mockRestore();
  });

  function createDashboard(annotations: Record<string, string> = {}): PredefinedVariablesDashboard {
    const meta = {
      canSave: true,
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

  it('writes a name array when checking one global and does not report radio analytics', () => {
    const dashboard = createDashboard();

    updateDashboardScopeVariable(dashboard, 'global', 'env', true, ['region', 'env']);

    expect(dashboard.state.meta.k8s?.annotations?.[AnnoKeyUseCrossDashboardVariables]).toBe(
      '{"global":["env"],"folder":"none"}'
    );
    expect(modeChangedSpy).not.toHaveBeenCalled();
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
      '{"global":["region","env"],"folder":"none"}'
    );
  });
});
