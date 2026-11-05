import { CustomVariable } from '@grafana/scenes';
import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import { updateDashboardScopeVariable } from '../sidebar/dashboard/DashboardCrossDashboardVariablesOptions';

import { fetchPredefinedVariables, toControlSourceRef } from './predefinedVariables';
import {
  allNamesForPredefinedRemoval,
  namesForPredefinedRemoval,
  removeOptedInPredefinedVariable,
} from './removeOptedInPredefinedVariable';
import { getDashboardSceneFor } from './utils';

jest.mock('./predefinedVariables', () => ({
  ...jest.requireActual('./predefinedVariables'),
  fetchPredefinedVariables: jest.fn(),
}));

jest.mock('./utils', () => ({
  getDashboardSceneFor: jest.fn(),
}));

jest.mock('../sidebar/dashboard/DashboardCrossDashboardVariablesOptions', () => ({
  updateDashboardScopeVariable: jest.fn(),
}));

describe('namesForPredefinedRemoval', () => {
  it('keeps the fetched sibling list when the variable is in it', () => {
    expect(namesForPredefinedRemoval(['env', 'region'], 'env', ['env'])).toEqual(['env', 'region']);
  });

  it('uses the names already on the dashboard when the fetch missed the variable', () => {
    expect(namesForPredefinedRemoval([], 'env', ['env', 'region'])).toEqual(['env', 'region']);
  });

  it('includes the variable when neither list has it', () => {
    expect(namesForPredefinedRemoval(['region'], 'env', ['region'])).toEqual(['region', 'env']);
  });
});

describe('allNamesForPredefinedRemoval', () => {
  it('returns nothing when the fetch failed', () => {
    expect(allNamesForPredefinedRemoval(null, 'env', ['env', 'region'], 'all')).toBeUndefined();
  });

  it('returns nothing when all is stored and the fetch missed the variable', () => {
    expect(allNamesForPredefinedRemoval(['region'], 'env', ['env'], 'all')).toBeUndefined();
  });

  it('returns the fetched siblings when all is stored and the variable was fetched', () => {
    expect(allNamesForPredefinedRemoval(['env', 'region', 'cluster'], 'env', ['env'], 'all')).toEqual([
      'env',
      'region',
      'cluster',
    ]);
  });

  it('still removes a listed name when the fetch missed it', () => {
    expect(allNamesForPredefinedRemoval(['region'], 'env', ['env', 'region'], ['env', 'region'])).toEqual([
      'region',
      'env',
    ]);
  });
});

describe('removeOptedInPredefinedVariable', () => {
  const dashboard = {
    state: {
      meta: {
        folderUid: 'folder-1',
        k8s: {
          annotations: {
            [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
          },
        },
      },
      $variables: {
        state: {
          variables: [
            new CustomVariable({
              name: 'env',
              query: 'a,b',
              origin: toControlSourceRef({ type: 'global' }),
            }),
          ],
        },
      },
    },
  };

  beforeEach(() => {
    jest.mocked(getDashboardSceneFor).mockReturnValue(dashboard as never);
    jest.mocked(updateDashboardScopeVariable).mockClear();
    jest.mocked(fetchPredefinedVariables).mockReset();
  });

  it('does not rewrite all when the fetch fails', async () => {
    jest.mocked(fetchPredefinedVariables).mockResolvedValue(null);

    await removeOptedInPredefinedVariable(
      new CustomVariable({
        name: 'env',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'global' }),
      })
    );

    expect(updateDashboardScopeVariable).not.toHaveBeenCalled();
  });

  it('does not rewrite all from the names on the dashboard when the fetch missed the variable', async () => {
    jest.mocked(fetchPredefinedVariables).mockResolvedValue([makeCandidate('region', 'global')]);

    await removeOptedInPredefinedVariable(
      new CustomVariable({
        name: 'env',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'global' }),
      })
    );

    expect(updateDashboardScopeVariable).not.toHaveBeenCalled();
  });

  it('opts out using the fetched sibling list', async () => {
    jest
      .mocked(fetchPredefinedVariables)
      .mockResolvedValue([makeCandidate('env', 'global'), makeCandidate('region', 'global')]);

    await removeOptedInPredefinedVariable(
      new CustomVariable({
        name: 'env',
        query: 'a,b',
        origin: toControlSourceRef({ type: 'global' }),
      })
    );

    expect(updateDashboardScopeVariable).toHaveBeenCalledWith(dashboard, 'global', 'env', false, ['env', 'region']);
  });
});

function makeCandidate(name: string, origin: 'global' | 'folder'): VariableKind {
  return {
    kind: 'CustomVariable',
    spec: {
      ...defaultCustomVariableSpec(),
      name,
      origin: toControlSourceRef(origin === 'global' ? { type: 'global' } : { type: 'folder', folderUid: 'folder-1' }),
    },
  } as VariableKind;
}
