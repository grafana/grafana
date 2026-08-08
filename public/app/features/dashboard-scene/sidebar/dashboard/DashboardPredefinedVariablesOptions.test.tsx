import { AnnoKeyIgnorePredefinedVariables } from 'app/features/apiserver/types';

import { DashboardInteractions } from '../../utils/interactions';
import { serializeIgnorePredefinedVariables } from '../../utils/predefinedVariableDenyList';

import { updateDashboardDenyList, type PredefinedVariablesDashboard } from './DashboardPredefinedVariablesOptions';

describe('updateDashboardDenyList', () => {
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

  it('reports mode change from all to none', () => {
    const dashboard = createDashboard();

    updateDashboardDenyList(dashboard, 'none');

    expect(modeChangedSpy).toHaveBeenCalledWith({
      from_mode: 'all',
      to_mode: 'none',
    });
    expect(dashboard.refreshPredefinedVariables).toHaveBeenCalled();
  });

  it('reports mode change from none to folder', () => {
    const dashboard = createDashboard({
      [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables(['*']),
    });

    updateDashboardDenyList(dashboard, 'folder');

    expect(modeChangedSpy).toHaveBeenCalledWith({
      from_mode: 'none',
      to_mode: 'folder',
    });
  });
});
