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
