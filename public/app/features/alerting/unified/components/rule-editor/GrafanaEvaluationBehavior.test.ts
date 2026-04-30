import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { namespaceToGroupOptions } from './GrafanaEvaluationBehavior';

describe('namespaceToGroupOptions', () => {
  it('excludes virtual ungrouped groups (names prefixed with no_group_for_rule_)', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [
        { name: 'real-group', interval: '1m', rules: [] },
        { name: `no_group_for_rule_${'a'.repeat(36)}`, interval: '1m', rules: [] },
      ],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'real-group', value: 'real-group' });
    expect(options.some((o) => o.label?.toString().startsWith('no_group_for_rule_'))).toBe(false);
  });

  it('returns options sorted alphabetically by group name', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [
        { name: 'banana', interval: '1m', rules: [] },
        { name: 'apple', interval: '1m', rules: [] },
        { name: 'cherry', interval: '1m', rules: [] },
      ],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options.map((o) => o.label)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('includes a pending group that is not yet returned by the API', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, { name: 'just-created', interval: '5m' });

    expect(options.map((o) => o.value)).toEqual(['existing', 'just-created']);
    expect(options.find((o) => o.value === 'just-created')).toMatchObject({
      label: 'just-created',
      description: '5m',
    });
  });

  it('does not duplicate the pending group when it already exists in the namespace', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, { name: 'existing', interval: '1m' });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'existing', description: '1m' });
  });

  it('does not include a pending group whose name is a virtual ungrouped name', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, {
      name: `no_group_for_rule_${'a'.repeat(36)}`,
      interval: '1m',
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'existing' });
  });
});
