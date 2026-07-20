import { defaultCustomVariableSpec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  ALLOW_ALL_FOLDER_PREDEFINED,
  ALLOW_ALL_GLOBAL_PREDEFINED,
  ALLOW_ALL_PREDEFINED,
  AnnoKeyUsePredefinedVariables,
} from 'app/features/apiserver/types';

import {
  applyPredefinedVariableAllowList,
  mayInjectAnyPredefinedVariables,
  parseUsePredefinedVariables,
  resolvePredefinedVariablesForDashboard,
  serializeUsePredefinedVariables,
} from './predefinedVariableAllowList';
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

describe('parseUsePredefinedVariables', () => {
  it('returns undefined when the annotation is absent', () => {
    expect(parseUsePredefinedVariables(undefined)).toBeUndefined();
    expect(parseUsePredefinedVariables({})).toBeUndefined();
    expect(parseUsePredefinedVariables({ [AnnoKeyUsePredefinedVariables]: '' })).toBeUndefined();
  });

  it('parses "*" and string arrays', () => {
    expect(
      parseUsePredefinedVariables({
        [AnnoKeyUsePredefinedVariables]: '{"predefinedVariablesAllowList":"*"}',
      })
    ).toEqual({ predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED });

    expect(
      parseUsePredefinedVariables({
        [AnnoKeyUsePredefinedVariables]: '{"predefinedVariablesAllowList":["global:*","env"]}',
      })
    ).toEqual({ predefinedVariablesAllowList: [ALLOW_ALL_GLOBAL_PREDEFINED, 'env'] });

    expect(
      parseUsePredefinedVariables({
        [AnnoKeyUsePredefinedVariables]: '{"predefinedVariablesAllowList":[]}',
      })
    ).toEqual({ predefinedVariablesAllowList: [] });
  });

  it('treats invalid JSON as deny-all', () => {
    expect(
      parseUsePredefinedVariables({
        [AnnoKeyUsePredefinedVariables]: '{not-json',
      })
    ).toEqual({ predefinedVariablesAllowList: [] });

    expect(
      parseUsePredefinedVariables({
        [AnnoKeyUsePredefinedVariables]: '{"predefinedVariablesAllowList":123}',
      })
    ).toEqual({ predefinedVariablesAllowList: [] });
  });
});

describe('applyPredefinedVariableAllowList', () => {
  it('keeps all for "*"', () => {
    expect(
      applyPredefinedVariableAllowList(globalsAndFolder, {
        predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED,
      }).map((v) => v.spec.name)
    ).toEqual(['region', 'env', 'cluster']);
  });

  it('keeps globals for global:*', () => {
    expect(
      applyPredefinedVariableAllowList(globalsAndFolder, {
        predefinedVariablesAllowList: [ALLOW_ALL_GLOBAL_PREDEFINED],
      }).map((v) => v.spec.name)
    ).toEqual(['region', 'env']);
  });

  it('keeps folder vars for folder:*', () => {
    expect(
      applyPredefinedVariableAllowList(globalsAndFolder, {
        predefinedVariablesAllowList: [ALLOW_ALL_FOLDER_PREDEFINED],
      }).map((v) => v.spec.name)
    ).toEqual(['cluster']);
  });

  it('keeps exact names from either origin', () => {
    expect(
      applyPredefinedVariableAllowList(globalsAndFolder, {
        predefinedVariablesAllowList: ['env', 'cluster'],
      }).map((v) => v.spec.name)
    ).toEqual(['env', 'cluster']);
  });

  it('keeps nothing for empty allowlist', () => {
    expect(
      applyPredefinedVariableAllowList(globalsAndFolder, {
        predefinedVariablesAllowList: [],
      })
    ).toEqual([]);
  });
});

describe('resolvePredefinedVariablesForDashboard', () => {
  it('uses allowlist when present', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyUsePredefinedVariables]: serializeUsePredefinedVariables({
            predefinedVariablesAllowList: [],
          }),
        },
      })
    ).toEqual([]);
  });

  it('injects nothing when annotation is absent', () => {
    expect(resolvePredefinedVariablesForDashboard(globalsAndFolder, {})).toEqual([]);
  });

  it('injects matching origins for allowlist sentinels', () => {
    expect(
      resolvePredefinedVariablesForDashboard(globalsAndFolder, {
        annotations: {
          [AnnoKeyUsePredefinedVariables]: serializeUsePredefinedVariables({
            predefinedVariablesAllowList: [ALLOW_ALL_GLOBAL_PREDEFINED],
          }),
        },
      }).map((v) => v.spec.name)
    ).toEqual(['region', 'env']);
  });
});

describe('mayInjectAnyPredefinedVariables', () => {
  it('is false for absent annotation', () => {
    expect(mayInjectAnyPredefinedVariables({})).toBe(false);
  });

  it('is true for allow-all annotation', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyUsePredefinedVariables]: serializeUsePredefinedVariables({
            predefinedVariablesAllowList: ALLOW_ALL_PREDEFINED,
          }),
        },
      })
    ).toBe(true);
  });

  it('is false for empty allowlist annotation', () => {
    expect(
      mayInjectAnyPredefinedVariables({
        annotations: {
          [AnnoKeyUsePredefinedVariables]: serializeUsePredefinedVariables({
            predefinedVariablesAllowList: [],
          }),
        },
      })
    ).toBe(false);
  });
});
