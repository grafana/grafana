import { type Variable, type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import {
  buildVariableResource,
  buildVariablesTree,
  getVariableEditableType,
  getVariableFolderUid,
  getVariableSpecName,
} from './utils';

function makeVariable(specName: string, folderUid?: string, spec?: object): Variable {
  return {
    metadata: {
      name: folderUid ? `${specName}--${folderUid}` : specName,
      ...(folderUid && { annotations: { [AnnoKeyFolder]: folderUid } }),
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: (spec ?? {
      kind: 'CustomVariable',
      spec: { name: specName, query: 'a,b,c', current: { text: 'a', value: 'a' } },
    }) as VariableSpec,
  };
}

describe('getVariableSpecName', () => {
  it('returns the logical name from the union spec', () => {
    expect(getVariableSpecName(makeVariable('region'))).toBe('region');
  });
});

describe('getVariableFolderUid', () => {
  it('returns undefined for global variables', () => {
    expect(getVariableFolderUid(makeVariable('region'))).toBeUndefined();
  });

  it('returns the folder annotation for folder-scoped variables', () => {
    expect(getVariableFolderUid(makeVariable('region', 'folder-1'))).toBe('folder-1');
  });
});

describe('getVariableEditableType', () => {
  it.each([
    ['QueryVariable', 'query'],
    ['TextVariable', 'textbox'],
    ['ConstantVariable', 'constant'],
    ['DatasourceVariable', 'datasource'],
    ['IntervalVariable', 'interval'],
    ['CustomVariable', 'custom'],
    ['GroupByVariable', 'groupby'],
    ['AdhocVariable', 'adhoc'],
    ['SwitchVariable', 'switch'],
  ])('maps %s to %s', (kind, expected) => {
    const variable = makeVariable('v', undefined, { kind, spec: { name: 'v' } });
    expect(getVariableEditableType(variable)).toBe(expected);
  });
});

describe('buildVariableResource', () => {
  const kind = {
    kind: 'CustomVariable' as const,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: { name: 'region', query: 'a,b' } as never,
  };

  it('omits metadata.name so the server derives it', () => {
    const resource = buildVariableResource(kind);
    expect(resource.metadata.name).toBeUndefined();
    expect(resource.metadata.annotations).toBeUndefined();
  });

  it('sets the folder annotation for folder-scoped variables', () => {
    const resource = buildVariableResource(kind, 'folder-1');
    expect(resource.metadata.annotations).toEqual({ [AnnoKeyFolder]: 'folder-1' });
  });
});

describe('buildVariablesTree', () => {
  it('groups variables by folder with globals at the root', () => {
    const variables = [
      makeVariable('zeta'),
      makeVariable('alpha'),
      makeVariable('one', 'folder-b'),
      makeVariable('two', 'folder-a'),
      makeVariable('three', 'folder-a'),
    ];

    const tree = buildVariablesTree(variables, { 'folder-a': 'Team A', 'folder-b': 'Team B' });

    expect(tree.global.map(getVariableSpecName)).toEqual(['alpha', 'zeta']);
    expect(tree.folders.map((f) => f.title)).toEqual(['Team A', 'Team B']);
    expect(tree.folders[0].variables.map(getVariableSpecName)).toEqual(['three', 'two']);
    expect(tree.folders[1].variables.map(getVariableSpecName)).toEqual(['one']);
  });

  it('sorts folders by title and falls back to the uid when no title is resolved', () => {
    const tree = buildVariablesTree([makeVariable('v', 'folder-x')], {});
    expect(tree.folders[0].title).toBe('folder-x');
  });

  it('returns an empty model for no variables', () => {
    const tree = buildVariablesTree([], {});
    expect(tree.folders).toEqual([]);
    expect(tree.global).toEqual([]);
  });
});
