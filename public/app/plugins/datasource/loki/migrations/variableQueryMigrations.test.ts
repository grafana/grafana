import { LokiVariableQuery, LokiVariableQueryType } from '../types';

import { migrateVariableQuery } from './variableQueryMigrations';

describe('Loki migrateVariableQuery()', () => {
  it('Does not migrate LokiVariableQuery instances', () => {
    const query: LokiVariableQuery = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: 'stream',
    };

    expect(migrateVariableQuery(query)).toBe(query);
    expect(migrateVariableQuery(query)).toStrictEqual(query);
  });

  it('Migrates label_names() queries', () => {
    const query = 'label_names()';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelNames,
    });
  });

  it('Migrates label_values(label) queries', () => {
    const query = 'label_values(label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: undefined,
    });
  });

  it('Migrates label_values(log stream selector, label) queries', () => {
    const query = 'label_values(log stream selector, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: 'log stream selector',
    });
  });
});
