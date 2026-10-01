import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { AnnoKeyUseCrossDashboardVariables } from 'app/features/apiserver/types';

import {
  applyUseCrossDashboardVariables,
  countPredefinedVariableOrigins,
  getGlobalVariablesMode,
  isPredefinedNameSelected,
  isScopeNameSelected,
  mayInjectAnyPredefinedVariables,
  parseUseCrossDashboardVariables,
  resolvePredefinedVariablesForDashboard,
  serializeUseCrossDashboardVariables,
  setScopeAll,
  toggleSelectionName,
  toggleScopeName,
  writeUseCrossDashboardVariables,
} from './crossDashboardVariablesSelection';
import { toControlSourceRef } from './predefinedVariables';

function makeVar(name: string, origin: 'global' | 'folder'): VariableKind {
  return {
    kind: 'CustomVariable',
    spec: {
      ...defaultCustomVariableSpec(),
      name,
      query: 'a,b',
      origin: toControlSourceRef(origin === 'global' ? { type: 'global' } : { type: 'folder', folderUid: 'folder-1' }),
    },
  };
}

const globalsAndFolder = [makeVar('region', 'global'), makeVar('env', 'global'), makeVar('cluster', 'folder')];

describe('parseUseCrossDashboardVariables', () => {
  it('returns undefined when the annotation is absent', () => {
    expect(parseUseCrossDashboardVariables(undefined)).toBeUndefined();
    expect(parseUseCrossDashboardVariables({})).toBeUndefined();
    expect(parseUseCrossDashboardVariables({ [AnnoKeyUseCrossDashboardVariables]: '' })).toBeUndefined();
  });

  it('parses all / none / name arrays and treats a missing scope as none', () => {
    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
      })
    ).toEqual({ global: 'all', folder: 'none' });

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":["env","ds"],"folder":["cluster"]}',
      })
    ).toEqual({ global: ['env', 'ds'], folder: ['cluster'] });

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":"all"}',
      })
    ).toEqual({ global: 'all', folder: 'none' });

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":[],"folder":"all"}',
      })
    ).toEqual({ global: 'none', folder: 'all' });
  });

  it('treats invalid JSON as undefined (same as absent)', () => {
    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{not-json',
      })
    ).toBeUndefined();

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '["env"]',
      })
    ).toBeUndefined();

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":123}',
      })
    ).toBeUndefined();

    expect(
      parseUseCrossDashboardVariables({
        [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":[1]}',
      })
    ).toBeUndefined();
  });
});

describe('serializeUseCrossDashboardVariables', () => {
  it('omits the annotation when both scopes are none', () => {
    expect(serializeUseCrossDashboardVariables({ global: 'none', folder: 'none' })).toBeUndefined();
    expect(serializeUseCrossDashboardVariables({ global: [], folder: [] })).toBeUndefined();
  });

  it('writes both scopes as a JSON object', () => {
    expect(serializeUseCrossDashboardVariables({ global: 'all', folder: 'all' })).toBe(
      '{"global":"all","folder":"all"}'
    );
    expect(serializeUseCrossDashboardVariables({ global: 'all', folder: 'none' })).toBe(
      '{"global":"all","folder":"none"}'
    );
    expect(serializeUseCrossDashboardVariables({ global: ['env', 'ds'], folder: ['cluster'] })).toBe(
      '{"global":["ds","env"],"folder":["cluster"]}'
    );
  });

  it('sorts name arrays so uncheck-then-recheck serializes the same', () => {
    const original = serializeUseCrossDashboardVariables({ global: ['region', 'env'], folder: 'none' });
    expect(original).toBe('{"global":["env","region"],"folder":"none"}');
    expect(serializeUseCrossDashboardVariables({ global: ['env', 'region'], folder: 'none' })).toBe(original);

    const afterUncheck = toggleScopeName(['region', 'env'], 'region', false, ['region', 'env']);
    const afterRecheck = toggleScopeName(afterUncheck, 'region', true, ['region', 'env']);
    expect(serializeUseCrossDashboardVariables({ global: afterRecheck, folder: 'none' })).toBe(original);
  });
});

describe('writeUseCrossDashboardVariables', () => {
  it('sets the annotation for an opted-in selection and deletes it for none', () => {
    const annotations: Record<string, string> = { keep: 'yes' };

    writeUseCrossDashboardVariables(annotations, { global: 'all', folder: 'none' });
    expect(annotations).toEqual({
      keep: 'yes',
      [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
    });

    writeUseCrossDashboardVariables(annotations, { global: 'none', folder: 'none' });
    expect(annotations).toEqual({ keep: 'yes' });
  });

  it('drops grafana.app/ignorePredefinedVariables on persist', () => {
    // Older dashboards may still carry this unread denylist. Persist must delete it
    // or the key is copied into every later save.
    const annotations: Record<string, string> = {
      'grafana.app/ignorePredefinedVariables': 'global:*,folder:*',
      keep: 'yes',
    };

    writeUseCrossDashboardVariables(annotations, { global: ['env'], folder: 'none' });
    expect(Object.keys(annotations)).toEqual(['keep', AnnoKeyUseCrossDashboardVariables]);
    expect(annotations).toEqual({
      keep: 'yes',
      [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
    });

    writeUseCrossDashboardVariables(annotations, { global: 'none', folder: 'none' });
    expect(annotations).toEqual({ keep: 'yes' });
  });
});

describe('applyUseCrossDashboardVariables', () => {
  it('keeps every variable when both scopes are all', () => {
    expect(
      applyUseCrossDashboardVariables(globalsAndFolder, { global: 'all', folder: 'all' }).map((v) => v.spec.name)
    ).toEqual(['region', 'env', 'cluster']);
  });

  it('keeps none when both scopes are none', () => {
    expect(applyUseCrossDashboardVariables(globalsAndFolder, { global: 'none', folder: 'none' })).toEqual([]);
  });

  it('keeps only globals when folder is none', () => {
    expect(
      applyUseCrossDashboardVariables(globalsAndFolder, { global: 'all', folder: 'none' }).map((v) => v.spec.name)
    ).toEqual(['region', 'env']);
  });

  it('keeps only listed names in each scope', () => {
    expect(
      applyUseCrossDashboardVariables(globalsAndFolder, { global: ['env'], folder: ['cluster'] }).map(
        (v) => v.spec.name
      )
    ).toEqual(['env', 'cluster']);
  });

  it('keeps a folder variable whose name was selected as global after scope reclassification', () => {
    // mergePredefinedVariables drops the global when a folder var reuses the name.
    const shadowed = [makeVar('env', 'folder'), makeVar('cluster', 'folder')];
    expect(
      applyUseCrossDashboardVariables(shadowed, { global: ['env'], folder: 'none' }).map((v) => v.spec.name)
    ).toEqual(['env']);
  });

  it('does not treat global all as opting in folder-only names', () => {
    const shadowed = [makeVar('env', 'folder'), makeVar('cluster', 'folder')];
    expect(
      applyUseCrossDashboardVariables(shadowed, { global: 'all', folder: 'none' }).map((v) => v.spec.name)
    ).toEqual([]);
  });
});

describe('resolvePredefinedVariablesForDashboard', () => {
  it('injects none when annotation is absent', () => {
    expect(resolvePredefinedVariablesForDashboard(globalsAndFolder, {})).toEqual([]);
  });

  it('injects all when both scopes are all', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"all"}',
        },
      }).map((v) => v.spec.name)
    ).toEqual(['region', 'env', 'cluster']);
  });

  it('injects folder vars when only folder is all', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"none","folder":"all"}',
        },
      }).map((v) => v.spec.name)
    ).toEqual(['cluster']);
  });

  it('injects listed names only', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":["region"],"folder":"none"}',
        },
      }).map((v) => v.spec.name)
    ).toEqual(['region']);
  });
});

describe('mayInjectAnyPredefinedVariables', () => {
  it('is false for absent annotation', () => {
    expect(mayInjectAnyPredefinedVariables({})).toBe(false);
  });

  it('is true when a scope is all', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"all","folder":"none"}',
        },
      })
    ).toBe(true);
  });

  it('is true for a non-empty name list', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":["env"],"folder":"none"}',
        },
      })
    ).toBe(true);
  });

  it('is false when both scopes are none', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyUseCrossDashboardVariables]: '{"global":"none","folder":"none"}',
        },
      })
    ).toBe(false);
  });
});

describe('getGlobalVariablesMode', () => {
  it('maps missing selection and both-none to none, and both-all to all', () => {
    expect(getGlobalVariablesMode(undefined)).toBe('none');
    expect(getGlobalVariablesMode({ global: 'none', folder: 'none' })).toBe('none');
    expect(getGlobalVariablesMode({ global: 'all', folder: 'all' })).toBe('all');
  });

  it('maps a single all scope to that coarse mode', () => {
    expect(getGlobalVariablesMode({ global: 'all', folder: 'none' })).toBe('global');
    expect(getGlobalVariablesMode({ global: 'none', folder: 'all' })).toBe('folder');
  });

  it('returns undefined for name lists or mixed combinations', () => {
    expect(getGlobalVariablesMode({ global: ['env'], folder: 'none' })).toBeUndefined();
    expect(getGlobalVariablesMode({ global: 'all', folder: ['cluster'] })).toBeUndefined();
  });
});

describe('toggleScopeName', () => {
  const allNames = ['region', 'env'];

  it('adds a name to none as a name array', () => {
    expect(toggleScopeName('none', 'env', true, allNames)).toEqual(['env']);
  });

  it('adds a name without promoting a complete list to all', () => {
    expect(toggleScopeName(['region'], 'env', true, allNames)).toEqual(['region', 'env']);
  });

  it('unchecking from all writes the remaining names', () => {
    expect(toggleScopeName('all', 'env', false, allNames)).toEqual(['region']);
  });

  it('unchecking the last name writes none', () => {
    expect(toggleScopeName(['env'], 'env', false, allNames)).toBe('none');
  });
});

describe('isScopeNameSelected', () => {
  it('selects every name for all and none for none', () => {
    expect(isScopeNameSelected('all', 'env')).toBe(true);
    expect(isScopeNameSelected('none', 'env')).toBe(false);
    expect(isScopeNameSelected(['env'], 'env')).toBe(true);
    expect(isScopeNameSelected(['env'], 'region')).toBe(false);
  });
});

describe('isPredefinedNameSelected', () => {
  it('selects a folder name that is listed only under global', () => {
    expect(isPredefinedNameSelected({ global: ['env'], folder: 'none' }, 'folder', 'env')).toBe(true);
    expect(isPredefinedNameSelected({ global: ['env'], folder: 'none' }, 'folder', 'cluster')).toBe(false);
  });

  it('does not treat the other scope all as a name match', () => {
    expect(isPredefinedNameSelected({ global: 'all', folder: 'none' }, 'folder', 'env')).toBe(false);
  });
});

describe('setScopeAll', () => {
  it('writes all when checked and none when unchecked', () => {
    expect(setScopeAll(true)).toBe('all');
    expect(setScopeAll(false)).toBe('none');
  });
});

describe('toggleSelectionName', () => {
  const allNames = ['env', 'cluster'];

  it('adds a name to the listed scope', () => {
    expect(toggleSelectionName({ global: 'none', folder: 'none' }, 'folder', 'env', true, allNames)).toEqual({
      global: 'none',
      folder: ['env'],
    });
  });

  it('drops the name from both scopes on uncheck', () => {
    expect(
      toggleSelectionName({ global: ['env', 'region'], folder: 'none' }, 'folder', 'env', false, allNames)
    ).toEqual({
      global: ['region'],
      folder: 'none',
    });
  });
});

describe('countPredefinedVariableOrigins', () => {
  it('counts global and folder origins', () => {
    expect(countPredefinedVariableOrigins(globalsAndFolder)).toEqual({
      global_count: 2,
      folder_count: 1,
      total_count: 3,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(countPredefinedVariableOrigins([])).toEqual({
      global_count: 0,
      folder_count: 0,
      total_count: 0,
    });
  });
});
