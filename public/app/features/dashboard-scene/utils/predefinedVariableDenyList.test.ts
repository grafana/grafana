import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  AnnoKeyIgnorePredefinedVariables,
  DENY_ALL_FOLDER_PREDEFINED,
  DENY_ALL_GLOBAL_PREDEFINED,
  DENY_ALL_PREDEFINED,
} from 'app/features/apiserver/types';

import {
  applyPredefinedVariableDenyList,
  mayInjectAnyPredefinedVariables,
  parseIgnorePredefinedVariables,
  resolvePredefinedVariablesForDashboard,
  serializeIgnorePredefinedVariables,
} from './predefinedVariableDenyList';
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

describe('parseIgnorePredefinedVariables', () => {
  it('returns undefined when the annotation is absent', () => {
    expect(parseIgnorePredefinedVariables(undefined)).toBeUndefined();
    expect(parseIgnorePredefinedVariables({})).toBeUndefined();
    expect(parseIgnorePredefinedVariables({ [AnnoKeyIgnorePredefinedVariables]: '' })).toBeUndefined();
  });

  it('parses string arrays', () => {
    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '["global:*","env"]',
      })
    ).toEqual([DENY_ALL_GLOBAL_PREDEFINED, 'env']);

    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '[]',
      })
    ).toEqual([]);

    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '["*"]',
      })
    ).toEqual([DENY_ALL_PREDEFINED]);
  });

  it('treats invalid JSON as fail-open (undefined)', () => {
    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '{not-json',
      })
    ).toBeUndefined();

    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '{"deny":[]}',
      })
    ).toBeUndefined();

    expect(
      parseIgnorePredefinedVariables({
        [AnnoKeyIgnorePredefinedVariables]: '[123]',
      })
    ).toBeUndefined();
  });
});

describe('applyPredefinedVariableDenyList', () => {
  it('drops all for "*"', () => {
    expect(applyPredefinedVariableDenyList(globalsAndFolder, [DENY_ALL_PREDEFINED])).toEqual([]);
  });

  it('drops globals for global:*', () => {
    expect(
      applyPredefinedVariableDenyList(globalsAndFolder, [DENY_ALL_GLOBAL_PREDEFINED]).map((v) => v.spec.name)
    ).toEqual(['cluster']);
  });

  it('drops folder vars for folder:*', () => {
    expect(
      applyPredefinedVariableDenyList(globalsAndFolder, [DENY_ALL_FOLDER_PREDEFINED]).map((v) => v.spec.name)
    ).toEqual(['region', 'env']);
  });

  it('drops exact names from either origin', () => {
    expect(applyPredefinedVariableDenyList(globalsAndFolder, ['env', 'cluster']).map((v) => v.spec.name)).toEqual([
      'region',
    ]);
  });

  it('keeps all for empty denylist', () => {
    expect(applyPredefinedVariableDenyList(globalsAndFolder, []).map((v) => v.spec.name)).toEqual([
      'region',
      'env',
      'cluster',
    ]);
  });

  it('combines sentinel and exact names', () => {
    expect(
      applyPredefinedVariableDenyList(globalsAndFolder, [DENY_ALL_GLOBAL_PREDEFINED, 'cluster']).map((v) => v.spec.name)
    ).toEqual([]);
  });
});

describe('resolvePredefinedVariablesForDashboard', () => {
  it('injects all when annotation is absent', () => {
    expect(resolvePredefinedVariablesForDashboard(globalsAndFolder, {}).map((v) => v.spec.name)).toEqual([
      'region',
      'env',
      'cluster',
    ]);
  });

  it('injects all for empty denylist', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([]),
        },
      }).map((v) => v.spec.name)
    ).toEqual(['region', 'env', 'cluster']);
  });

  it('applies denylist when present', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([DENY_ALL_GLOBAL_PREDEFINED]),
        },
      }).map((v) => v.spec.name)
    ).toEqual(['cluster']);
  });

  it('injects nothing for deny-all', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([DENY_ALL_PREDEFINED]),
        },
      })
    ).toEqual([]);
  });
});

describe('mayInjectAnyPredefinedVariables', () => {
  it('is true for absent annotation', () => {
    expect(mayInjectAnyPredefinedVariables({})).toBe(true);
  });

  it('is true for empty denylist', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([]),
        },
      })
    ).toBe(true);
  });

  it('is true for partial denylist', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([DENY_ALL_GLOBAL_PREDEFINED]),
        },
      })
    ).toBe(true);
  });

  it('is false for deny-all', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyIgnorePredefinedVariables]: serializeIgnorePredefinedVariables([DENY_ALL_PREDEFINED]),
        },
      })
    ).toBe(false);
  });
});
