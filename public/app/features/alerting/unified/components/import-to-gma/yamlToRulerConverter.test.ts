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

  it('should throw error for missing groups array', () => {
    const yaml = `
      namespace: test-namespace
      invalid: content
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array'
    );
  });

  it('should throw error for invalid group format', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - invalid: group
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array at index 0'
    );
  });

  it('should throw error for invalid rule format', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: test-group
          rules:
            - invalid: rule
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array at index 0'
    );
  });

  it('should throw error for empty YAML string', () => {
    const emptyYaml = '';
    expect(() => parseYamlToRulerRulesConfigDTO(emptyYaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array'
    );
  });

  it('should throw error for rule missing expr field', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: test-group
          rules:
            - alert: TestAlert
              for: 5m
              labels:
                severity: warning
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array at index 0'
    );
  });

  it('should throw error for rule with expr but missing both alert and record fields', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: test-group
          rules:
            - expr: up == 0
              for: 5m
              labels:
                severity: warning
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array at index 0'
    );
  });

  it('should throw error for rule with both alert and record fields', () => {
    const yaml = `
      namespace: test-namespace
      groups:
        - name: test-group
          rules:
            - alert: TestAlert
              record: test:rate5m
              expr: up == 0
              for: 5m
    `;
    expect(() => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace')).toThrow(
      'Invalid YAML format: missing or invalid groups array at index 0'
    );
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

  describe('validation edge cases', () => {
    // toThrow(new Error(..)) compares the whole message; a string argument only matches a substring.
    const GROUPS_ERROR = 'Invalid YAML format: missing or invalid groups array';
    const NAMESPACE_ERROR = 'Invalid YAML format: namespace must be a string';
    const groupAt = (i: number) => `${GROUPS_ERROR} at index ${i}`;
    const parse = (yaml: string) => parseYamlToRulerRulesConfigDTO(yaml, 'default-namespace');
    const withRule = (rule: string) => `
groups:
  - name: g
    rules:
      - expr: up == 0
${rule
  .split('\n')
  .map((line) => `        ${line}`)
  .join('\n')}
`;

    it.each([
      ['non-string for', 'alert: A\nfor: 5'],
      ['null for', 'alert: A\nfor: null'],
      ['null labels', 'alert: A\nlabels: null'],
      ['scalar labels', 'alert: A\nlabels: foo'],
      ['scalar annotations', 'alert: A\nannotations: 5'],
      ['null annotations', 'alert: A\nannotations: null'],
      ['empty alert and no record', 'alert: ""'],
      ['empty record and no alert', 'record: ""'],
    ])('rejects a rule with %s', (_name, rule) => {
      expect(() => parse(withRule(rule))).toThrow(new Error(groupAt(0)));
    });

    it('rejects a rule with an empty expr', () => {
      const yaml = `
groups:
  - name: g
    rules:
      - alert: A
        expr: ""
`;
      expect(() => parse(yaml)).toThrow(new Error(groupAt(0)));
    });

    it.each([
      ['a group without rules', 'groups:\n  - name: g'],
      ['a group with non-array rules', 'groups:\n  - name: g\n    rules: nope'],
      ['a group without a name', 'groups:\n  - rules: []'],
      ['a group with an empty name', 'groups:\n  - name: ""\n    rules: []'],
      ['a scalar group', 'groups:\n  - nope'],
      ['a null group', 'groups:\n  - null'],
    ])('rejects %s', (_name, yaml) => {
      expect(() => parse(yaml)).toThrow(new Error(groupAt(0)));
    });

    it('reports the index of the first invalid group', () => {
      const yaml = `
groups:
  - name: ok
    rules:
      - alert: A
        expr: up == 0
  - name: bad
    rules:
      - invalid: rule
`;
      expect(() => parse(yaml)).toThrow(new Error(groupAt(1)));
    });

    it.each([
      ['groups is not an array', 'groups: nope'],
      ['groups is null', 'groups: null'],
      ['the document is a scalar', 'just a string'],
      ['the document is null', 'null'],
    ])('rejects a file where %s', (_name, yaml) => {
      expect(() => parse(yaml)).toThrow(new Error(GROUPS_ERROR));
    });

    it('rejects a non-string namespace', () => {
      expect(() => parse('namespace: 5\ngroups: []')).toThrow(new Error(NAMESPACE_ERROR));
      expect(() => parse('namespace: null\ngroups: []')).toThrow(new Error(NAMESPACE_ERROR));
    });

    it('reports the groups error before the namespace error', () => {
      expect(() => parse('namespace: 5\ngroups: nope')).toThrow(new Error(GROUPS_ERROR));
    });

    it('reports the namespace error before an invalid group', () => {
      expect(() => parse('namespace: 5\ngroups:\n  - invalid: group')).toThrow(new Error(NAMESPACE_ERROR));
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

    it('treats a non-string alert as absent when record is set', () => {
      expect(parse(withRule('alert: 5\nrecord: r'))).toEqual({
        'default-namespace': [{ name: 'g', rules: [{ alert: 5, record: 'r', expr: 'up == 0' }] }],
      });
    });

    it('accepts array and non-string-valued labels and annotations', () => {
      const result = parse(withRule('alert: A\nlabels: [a, b]\nannotations:\n  count: 1'));
      expect(result['default-namespace'][0].rules[0]).toMatchObject({ labels: ['a', 'b'], annotations: { count: 1 } });
    });

    it('keeps unknown keys on groups and rules', () => {
      const yaml = `
groups:
  - name: g
    interval: 1m
    limit: 5
    rules:
      - alert: A
        expr: up == 0
        keep_firing_for: 10m
`;
      expect(parse(yaml)).toEqual({
        'default-namespace': [
          {
            name: 'g',
            interval: '1m',
            limit: 5,
            rules: [{ alert: 'A', expr: 'up == 0', keep_firing_for: '10m' }],
          },
        ],
      });
    });
  });
});
