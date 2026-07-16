import { FieldMatcherID } from '@grafana/data';

import { payloads } from './schemas';

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
