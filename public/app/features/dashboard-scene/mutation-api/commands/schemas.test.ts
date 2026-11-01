import * as z from 'zod';

import { FieldMatcherID } from '@grafana/data';

import { payloads } from './schemas';

// A minimal, valid QueryVariable definition for the ADD_VARIABLE payload.
function variable(name: unknown) {
  return {
    kind: 'QueryVariable',
    spec: { name, query: { group: 'prometheus', spec: {} } },
  };
}

describe('variable payloads require a non-empty name', () => {
  it('ADD_VARIABLE rejects an omitted name', () => {
    const result = payloads.addVariable.safeParse({ variable: { kind: 'QueryVariable', spec: {} } });
    expect(result.success).toBe(false);
  });

  it('ADD_VARIABLE rejects an empty / whitespace name', () => {
    expect(payloads.addVariable.safeParse({ variable: variable('') }).success).toBe(false);
    expect(payloads.addVariable.safeParse({ variable: variable('   ') }).success).toBe(false);
  });

  it('ADD_VARIABLE accepts a named variable and defaults the query kind', () => {
    const result = payloads.addVariable.safeParse({ variable: variable('region') });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const parsed = result.data.variable;
    if (parsed.kind !== 'QueryVariable') {
      throw new Error('expected QueryVariable');
    }
    expect(parsed.spec.name).toBe('region');
    expect(parsed.spec.query.kind).toBe('DataQuery');
  });

  it('UPDATE_VARIABLE rejects an empty name on the new definition', () => {
    const result = payloads.updateVariable.safeParse({ name: 'region', variable: variable('') });
    expect(result.success).toBe(false);
  });

  it('UPDATE_ROW rejects an empty section-variable name', () => {
    const named = payloads.updateRow.safeParse({ path: '/rows/0', spec: { variables: [variable('region')] } });
    expect(named.success).toBe(true);
    const blank = payloads.updateRow.safeParse({ path: '/rows/0', spec: { variables: [variable('')] } });
    expect(blank.success).toBe(false);
  });

  it('UPDATE_TAB rejects an empty section-variable name', () => {
    const named = payloads.updateTab.safeParse({ path: '/tabs/0', spec: { variables: [variable('region')] } });
    expect(named.success).toBe(true);
    const blank = payloads.updateTab.safeParse({ path: '/tabs/0', spec: { variables: [variable('')] } });
    expect(blank.success).toBe(false);
  });
});

// Structurally valid: GroupByVariable is still a v2 spec kind, so only the payload rule rejects it.
function groupByVariable(name: string) {
  return { kind: 'GroupByVariable', group: 'prometheus', datasource: { name: 'prom' }, spec: { name } };
}

describe('variable payloads reject the deprecated GroupByVariable kind', () => {
  it.each([
    ['ADD_VARIABLE', () => payloads.addVariable.safeParse({ variable: groupByVariable('groupBy') })],
    [
      'UPDATE_VARIABLE',
      () => payloads.updateVariable.safeParse({ name: 'groupBy', variable: groupByVariable('groupBy') }),
    ],
    ['ADD_ROW', () => payloads.addRow.safeParse({ row: { spec: { variables: [groupByVariable('groupBy')] } } })],
    [
      'UPDATE_ROW',
      () => payloads.updateRow.safeParse({ path: '/rows/0', spec: { variables: [groupByVariable('groupBy')] } }),
    ],
    ['ADD_TAB', () => payloads.addTab.safeParse({ tab: { spec: { variables: [groupByVariable('groupBy')] } } })],
    [
      'UPDATE_TAB',
      () => payloads.updateTab.safeParse({ path: '/tabs/0', spec: { variables: [groupByVariable('groupBy')] } }),
    ],
  ])('%s points to enableGroupBy on an AdhocVariable', (_command, parse) => {
    const result = parse();

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContainEqual(
      expect.stringContaining('AdhocVariable with spec.enableGroupBy: true')
    );
  });

  it('names the replacement even when the GroupByVariable payload is incomplete', () => {
    const result = payloads.addVariable.safeParse({ variable: { kind: 'GroupByVariable', spec: { name: 'groupBy' } } });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ['variable', 'kind'],
        message: expect.stringContaining('AdhocVariable with spec.enableGroupBy: true'),
      }),
    ]);
  });

  it.each([
    ['ADD_VARIABLE', payloads.addVariable],
    ['UPDATE_VARIABLE', payloads.updateVariable],
    ['ADD_ROW', payloads.addRow],
    ['UPDATE_ROW', payloads.updateRow],
    ['ADD_TAB', payloads.addTab],
    ['UPDATE_TAB', payloads.updateTab],
  ])('%s no longer advertises GroupByVariable in its JSON schema', (_command, schema) => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(schema));

    expect(jsonSchema).toContain('AdhocVariable');
    expect(jsonSchema).not.toContain('GroupByVariable');
  });
});

function updatePanelPayloadWithMatcherId(matcherId: string) {
  return {
    element: { name: 'panel-1' },
    panel: {
      spec: {
        vizConfig: {
          spec: {
            fieldConfig: {
              defaults: {},
              overrides: [{ matcher: { id: matcherId, options: 'foo' }, properties: [] }],
            },
          },
        },
      },
    },
  };
}

describe('fieldConfigSchema matcher validation', () => {
  it.each(Object.values(FieldMatcherID))('accepts registered field matcher id "%s"', (matcherId) => {
    const result = payloads.updatePanel.safeParse(updatePanelPayloadWithMatcherId(matcherId));
    expect(result.success).toBe(true);
  });

  it('rejects an unknown matcher id with an error listing the valid options', () => {
    const result = payloads.updatePanel.safeParse(updatePanelPayloadWithMatcherId('byNamePattern'));

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected parse failure');
    }

    const issue = result.error.issues.find((i) => i.path.at(-1) === 'id');
    expect(issue?.path).toEqual(['panel', 'spec', 'vizConfig', 'spec', 'fieldConfig', 'overrides', 0, 'matcher', 'id']);
    expect(issue?.message).toContain('byName');
  });

  it('rejects an unknown matcher id on ADD_PANEL payloads', () => {
    const result = payloads.addPanel.safeParse({
      panel: {
        spec: {
          title: 'Test panel',
          data: { spec: { queries: [] } },
          vizConfig: {
            group: 'timeseries',
            spec: {
              fieldConfig: {
                overrides: [{ matcher: { id: 'byNamePattern' }, properties: [] }],
              },
            },
          },
        },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('transformation refId', () => {
  function transformation(spec: Record<string, unknown>) {
    return { kind: 'Transformation', group: 'limit', spec };
  }

  function parseUpdatePanelTransformation(spec: Record<string, unknown>) {
    const result = payloads.updatePanel.safeParse({
      element: { name: 'panel-1' },
      panel: { spec: { data: { spec: { transformations: [transformation(spec)] } } } },
    });
    if (!result.success) {
      throw new Error(`expected parse success: ${result.error.message}`);
    }
    return result.data.panel!.spec.data!.spec.transformations![0].spec;
  }

  it('keeps a user-set refId on UPDATE_PANEL', () => {
    expect(parseUpdatePanelTransformation({ refId: 'T1', options: { limitField: 10 } }).refId).toBe('T1');
  });

  it('leaves refId unset when the caller omits it', () => {
    expect(parseUpdatePanelTransformation({ options: {} }).refId).toBeUndefined();
  });

  it('keeps a user-set refId on ADD_PANEL', () => {
    const result = payloads.addPanel.safeParse({
      panel: {
        spec: {
          title: 'Transform panel',
          data: { spec: { queries: [], transformations: [transformation({ refId: 'T1', options: {} })] } },
          vizConfig: { group: 'timeseries', spec: {} },
        },
      },
    });

    if (!result.success) {
      throw new Error(`expected parse success: ${result.error.message}`);
    }
    expect(result.data.panel.spec.data.spec.transformations[0].spec.refId).toBe('T1');
  });
});

describe('GET_METADATA_ANNOTATIONS payload', () => {
  const key = 'grafana.app/useCrossDashboardVariables';

  it('accepts the allowlisted key', () => {
    expect(payloads.getMetadataAnnotations.safeParse({ annotations: [key] }).success).toBe(true);
  });

  it('rejects an empty key list', () => {
    expect(payloads.getMetadataAnnotations.safeParse({ annotations: [] }).success).toBe(false);
    expect(payloads.getMetadataAnnotations.safeParse({}).success).toBe(false);
  });

  it('rejects an unknown annotation key', () => {
    expect(
      payloads.getMetadataAnnotations.safeParse({
        annotations: ['grafana.app/createdBy'],
      }).success
    ).toBe(false);
  });
});

describe('UPDATE_METADATA_ANNOTATIONS payload', () => {
  const key = 'grafana.app/useCrossDashboardVariables';

  it('accepts all/none/name-array scopes under the allowlisted key', () => {
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: { global: 'all', folder: 'none' } },
      }).success
    ).toBe(true);
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: { global: ['env'], folder: ['cluster'] } },
      }).success
    ).toBe(true);
  });

  it('accepts null to clear the allowlisted annotation', () => {
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: null },
      }).success
    ).toBe(true);
  });

  it('rejects an invalid scope value', () => {
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: { global: 'maybe', folder: 'none' } },
      }).success
    ).toBe(false);
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: { global: [1], folder: 'none' } },
      }).success
    ).toBe(false);
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { [key]: { global: 'all' } },
      }).success
    ).toBe(false);
  });

  it('rejects an unknown annotation key', () => {
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: { 'grafana.app/createdBy': 'me' },
      }).success
    ).toBe(false);
    expect(
      payloads.updateMetadataAnnotations.safeParse({
        annotations: {
          [key]: { global: 'all', folder: 'none' },
          'grafana.app/folder': 'folder-1',
        },
      }).success
    ).toBe(false);
  });
});
