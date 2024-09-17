import { LokiVariableQuery, LokiVariableQueryType } from '../types';

import { migrateVariableQuery } from './variableQueryMigrations';

describe('Loki migrateVariableQuery()', () => {
  it('does not migrate LokiVariableQuery instances', () => {
    const query: LokiVariableQuery = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: 'stream',
    };

    expect(migrateVariableQuery(query)).toBe(query);
    expect(migrateVariableQuery(query)).toStrictEqual(query);
  });

  it('migrates label_names() queries', () => {
    const query = 'label_names()';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelNames,
    });
  });

  it('migrates label_values(label) queries', () => {
    const query = 'label_values(label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: undefined,
    });
  });

  it('migrates label_values(label) queries with template variable', () => {
    const query = 'label_values($label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: '$label',
      stream: undefined,
    });
  });

  it('migrates label_values(log stream selector, label) queries', () => {
    const query = 'label_values(log stream selector, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: 'log stream selector',
    });
  });

  it('migrates label_values(log stream selector, label) with template variable as stream', () => {
    const query = 'label_values($b, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: '$b',
    });
  });

  it('migrates label_values(log stream selector, label) with template variable in stream', () => {
    const query = 'label_values({$b="bar"}, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: '{$b="bar"}',
    });
  });

  it('migrates label_values(log stream selector, label) with template variable in label', () => {
    const query = 'label_values({$b="bar"}, $label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: '$label',
      stream: '{$b="bar"}',
    });
  });
});
