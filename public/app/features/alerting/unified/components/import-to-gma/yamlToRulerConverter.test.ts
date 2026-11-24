import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { parseYamlToRulerRulesConfigDTO } from './yamlToRulerConverter';

describe('parseYamlToRulerRulesConfigDTO', () => {
  it('should parse valid YAML with namespace', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: test-group
          rules:
            - alert: TestAlert
              expr: up == 0
              for: 5m
              labels:
                severity: warning
              annotations:
                description: "Test alert description"
    `;

    const expected: RulerRulesConfigDTO = {
      'test-namespace': [
        {
          name: 'test-group',
          rules: [
            {
              alert: 'TestAlert',
              expr: 'up == 0',
              for: '5m',
              labels: {
                severity: 'warning',
              },
              annotations: {
                description: 'Test alert description',
              },
            },
          ],
        },
      ],
    };

    const result = parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    expect(result).toEqual(expected);
  });

  it('should use default namespace when not specified in YAML', () => {
    const yaml = `
      groups:
        - name: test-group
          rules:
            - alert: TestAlert
              expr: up == 0
    `;

    const expected: RulerRulesConfigDTO = {
      'default-namespace': [
        {
          name: 'test-group',
          rules: [
            {
              alert: 'TestAlert',
              expr: 'up == 0',
            },
          ],
        },
      ],
    };

    const result = parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    expect(result).toEqual(expected);
  });

  it('should parse recording rules', () => {
    const yaml = `
      groups:
        - name: test-group
          rules:
            - record: test:rate5m
              expr: rate(prometheus_tsdb_reloads_total{job="prometheus"}[5m])
    `;
    const expected: RulerRulesConfigDTO = {
      'default-namespace': [
        {
          name: 'test-group',
          rules: [
            {
              record: 'test:rate5m',
              expr: 'rate(prometheus_tsdb_reloads_total{job="prometheus"}[5m])',
            },
          ],
        },
      ],
    };
    const result = parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    expect(result).toEqual(expected);
  });

  it('should throw error for invalid YAML format', () => {
    const invalidYaml = 'invalid: yaml: content';
    expect(() => parseYamlToRulerRulesConfigDTO(invalidYaml, 'default-namespace')).toThrow();
  });

  it('should handle multiple groups and rules', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: group1
          rules:
            - alert: Alert1
              expr: up == 0
            - alert: Alert2
              expr: down == 1
        - name: group2
          rules:
            - alert: Alert3
              expr: error == 1
    `;

    const expected: RulerRulesConfigDTO = {
      'test-namespace': [
        {
          name: 'group1',
          rules: [
            {
              alert: 'Alert1',
              expr: 'up == 0',
            },
            {
              alert: 'Alert2',
              expr: 'down == 1',
            },
          ],
        },
        {
          name: 'group2',
          rules: [
            {
              alert: 'Alert3',
              expr: 'error == 1',
            },
          ],
        },
      ],
    };

    const result = parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    expect(result).toEqual(expected);
  });

  describe('validation', () => {
    const parse = (yaml: string) => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    const errorOf = (yaml: string): string => {
      try {
        parse(yaml);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error('expected the YAML to be rejected');
    };
    const indent = (text: string, spaces: number) =>
      text
        .split('\n')
        .map((line) => ' '.repeat(spaces) + line)
        .join('\n');
    const withRule = (rule: string) => `
groups:
  - name: g
    rules:
      - expr: up == 0
${indent(rule, 8)}
`;
    const withGroup = (group: string) => `
groups:
  - name: g
${indent(group, 4)}
    rules: []
`;

    it.each([
      ['non-string for', 'alert: A\nfor: 5', 'groups[0].rules[0].for'],
      ['for that is not a duration', 'alert: A\nfor: five minutes', 'groups[0].rules[0].for'],
      ['for with units out of order', 'alert: A\nfor: 20s4h', 'groups[0].rules[0].for'],
      ['for with a repeated unit', 'alert: A\nfor: 20h20h', 'groups[0].rules[0].for'],
      ['a fractional for', 'alert: A\nfor: 1.5h', 'groups[0].rules[0].for'],
      ['an empty for', 'alert: A\nfor: ""', 'groups[0].rules[0].for'],
      [
        'keep_firing_for that is not a duration',
        'alert: A\nkeep_firing_for: soon',
        'groups[0].rules[0].keep_firing_for',
      ],
      ['scalar labels', 'alert: A\nlabels: foo', 'groups[0].rules[0].labels'],
      ['labels as a list', 'alert: A\nlabels: [team, ops]', 'groups[0].rules[0].labels'],
      ['a numeric label value', 'alert: A\nlabels:\n  priority: 1', 'groups[0].rules[0].labels.priority'],
      ['a boolean label value', 'alert: A\nlabels:\n  paging: true', 'groups[0].rules[0].labels.paging'],
      ['scalar annotations', 'alert: A\nannotations: 5', 'groups[0].rules[0].annotations'],
      ['annotations as a list', 'alert: A\nannotations: [a]', 'groups[0].rules[0].annotations'],
      ['a numeric annotation value', 'alert: A\nannotations:\n  count: 1', 'groups[0].rules[0].annotations.count'],
      ['a non-string alert', 'alert: 5\nrecord: r', 'groups[0].rules[0].alert'],
      ['a non-string record', 'alert: A\nrecord: 5', 'groups[0].rules[0].record'],
      ['an empty alert and no record', 'alert: ""', 'either an alert or a record'],
      ['an empty record and no alert', 'record: ""', 'either an alert or a record'],
      ['no alert and no record', 'for: 5m', 'either an alert or a record'],
      ['both alert and record', 'alert: A\nrecord: r', 'either an alert or a record'],
    ])('rejects a rule with %s', (_name, rule, expected) => {
      expect(errorOf(withRule(rule))).toContain(expected);
    });

    it('rejects a rule without expr', () => {
      expect(errorOf('groups:\n  - name: g\n    rules:\n      - alert: A')).toContain('groups[0].rules[0].expr');
    });

    it('rejects a rule with an empty expr', () => {
      expect(errorOf('groups:\n  - name: g\n    rules:\n      - alert: A\n        expr: ""')).toContain(
        'groups[0].rules[0].expr'
      );
    });

    it('rejects a rule that is not a map', () => {
      expect(errorOf('groups:\n  - name: g\n    rules:\n      - nope')).toContain('groups[0].rules[0]');
    });

    it.each([
      ['a group without rules', 'groups:\n  - name: g', 'groups[0].rules'],
      ['a group with non-array rules', 'groups:\n  - name: g\n    rules: nope', 'groups[0].rules'],
      ['a group without a name', 'groups:\n  - rules: []', 'groups[0].name'],
      ['a group with an empty name', 'groups:\n  - name: ""\n    rules: []', 'groups[0].name'],
      ['a scalar group', 'groups:\n  - nope', 'groups[0]'],
      ['a null group', 'groups:\n  - null', 'groups[0]'],
      ['an interval that is not a duration', withGroup('interval: 1 minute'), 'groups[0].interval'],
      ['a numeric interval', withGroup('interval: 60'), 'groups[0].interval'],
      ['an interval with units out of order', withGroup('interval: 20s4h'), 'groups[0].interval'],
      ['a null interval', withGroup('interval:'), 'groups[0].interval'],
      ['a query_offset that is not a duration', withGroup('query_offset: later'), 'groups[0].query_offset'],
      ['a limit', withGroup('limit: 5'), 'limit is not supported'],
      ['labels as a list', withGroup('labels: [team]'), 'groups[0].labels'],
      ['a numeric label value', withGroup('labels:\n  priority: 1'), 'groups[0].labels.priority'],
    ])('rejects %s', (_name, yaml, expected) => {
      expect(errorOf(yaml)).toContain(expected);
    });

    it.each([
      ['groups is not an array', 'groups: nope'],
      ['groups is null', 'groups: null'],
      ['groups is missing', 'namespace: test-namespace\ninvalid: content'],
      ['the document is a scalar', 'just a string'],
      ['the document is null', 'null'],
      ['the document is empty', ''],
    ])('rejects a file where %s', (_name, yaml) => {
      expect(() => parse(yaml)).toThrow();
    });

    it('reports at most ten issues and counts the rest', () => {
      const rules = Array.from(
        { length: 300 },
        (_, i) => `      - alert: A${i}\n        expr: up\n        labels:\n          priority: 1`
      );
      const message = errorOf(`groups:\n  - name: g\n    rules:\n${rules.join('\n')}`);
      expect(message).toContain('groups[0].rules[0].labels.priority');
      expect(message).toContain('and 290 more');
      expect(message.length).toBeLessThan(2000);
    });

    it('names the group and rule of every invalid rule', () => {
      const yaml = `
groups:
  - name: ok
    rules:
      - alert: A
        expr: up == 0
  - name: bad
    rules:
      - alert: B
      - alert: C
        expr: up == 0
        for: soon
`;
      const message = errorOf(yaml);
      expect(message).toContain('groups[1].rules[0].expr');
      expect(message).toContain('groups[1].rules[1].for');
      expect(message).not.toContain('groups[0]');
    });

    it('rejects a non-string namespace', () => {
      expect(errorOf('namespace: 5\ngroups: []')).toContain('namespace');
      expect(errorOf('namespace: null\ngroups: []')).toContain('namespace');
    });

    it('reports every problem in the file together', () => {
      const message = errorOf('namespace: 5\ngroups:\n  - invalid: group');
      expect(message).toContain('namespace');
      expect(message).toContain('groups[0].name');
    });

    it('accepts empty groups and groups without rules', () => {
      expect(parse('groups: []')).toEqual({ 'default-namespace': [] });
      expect(parse('groups:\n  - name: g\n    rules: []')).toEqual({
        'default-namespace': [{ name: 'g', rules: [] }],
      });
    });

    it('accepts an empty alert when record is set', () => {
      expect(parse(withRule('alert: ""\nrecord: r'))).toEqual({
        'default-namespace': [{ name: 'g', rules: [{ alert: '', record: 'r', expr: 'up == 0' }] }],
      });
    });

    it('accepts the fields the backend types as durations and string maps', () => {
      const yaml = `
groups:
  - name: g
    interval: 1m30s
    query_offset: 30s
    limit: 0
    labels:
      team: ops
    rules:
      - alert: A
        expr: up == 0
        for: 5m
        keep_firing_for: 10m
        labels:
          severity: warning
        annotations:
          summary: down
`;
      expect(parse(yaml)).toEqual({
        'default-namespace': [
          {
            name: 'g',
            interval: '1m30s',
            query_offset: '30s',
            limit: 0,
            labels: { team: 'ops' },
            rules: [
              {
                alert: 'A',
                expr: 'up == 0',
                for: '5m',
                keep_firing_for: '10m',
                labels: { severity: 'warning' },
                annotations: { summary: 'down' },
              },
            ],
          },
        ],
      });
    });

    it('accepts null where the backend ignores it', () => {
      const yaml = `
groups:
  - name: g
    query_offset:
    limit:
    labels:
    rules:
      - alert:
        record: r
        expr: up
        for:
        keep_firing_for:
        labels:
          severity:
        annotations:
      - alert: A
        expr: up
        annotations:
          summary:
`;
      expect(() => parse(yaml)).not.toThrow();
    });

    it('accepts every duration unit in descending order, and a quoted zero', () => {
      const yaml = `
groups:
  - name: g
    interval: 1y2w3d4h5m6s7ms
    rules:
      - alert: A
        expr: up
        for: 5ms
        keep_firing_for: "0"
`;
      expect(() => parse(yaml)).not.toThrow();
    });

    it('keeps unknown keys on groups and rules', () => {
      const yaml = `
groups:
  - name: g
    source_tenants: [tenant-a]
    rules:
      - alert: A
        expr: up == 0
        extra: value
`;
      expect(parse(yaml)).toEqual({
        'default-namespace': [
          { name: 'g', source_tenants: ['tenant-a'], rules: [{ alert: 'A', expr: 'up == 0', extra: 'value' }] },
        ],
      });
    });
  });
});
