import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

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
});
