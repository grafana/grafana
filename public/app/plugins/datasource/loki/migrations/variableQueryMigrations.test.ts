import { type LokiVariableQuery, LokiVariableQueryType } from '../types';

import { ensureStreamSelectorBraces, migrateVariableQuery } from './variableQueryMigrations';

describe('Loki ensureStreamSelectorBraces()', () => {
  it('wraps bare selector in braces', () => {
    expect(ensureStreamSelectorBraces('job="scene-logs"')).toBe('{job="scene-logs"}');
  });

  it('wraps bare selector with template variable in braces', () => {
    expect(ensureStreamSelectorBraces('$var')).toBe('{$var}');
  });

  it('does not double-wrap selector that already has braces', () => {
    expect(ensureStreamSelectorBraces('{job="scene-logs"}')).toBe('{job="scene-logs"}');
  });

  it('does not double-wrap selector with template variable that already has braces', () => {
    expect(ensureStreamSelectorBraces('{$var="bar"}')).toBe('{$var="bar"}');
  });

  it('returns empty string unchanged', () => {
    expect(ensureStreamSelectorBraces('')).toBe('');
  });

  it('returns empty selector unchanged', () => {
    expect(ensureStreamSelectorBraces('{}')).toBe('{}');
  });

  it('trims whitespace before checking for braces', () => {
    expect(ensureStreamSelectorBraces('  {job="foo"}  ')).toBe('{job="foo"}');
  });

  it('wraps trimmed bare selector with surrounding whitespace', () => {
    expect(ensureStreamSelectorBraces('  job="foo"  ')).toBe('{job="foo"}');
  });
});

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

  it('migrates label_values(log stream selector, label) queries and wraps bare selector in braces', () => {
    const query = 'label_values(log stream selector, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: '{log stream selector}',
    });
  });

  it('migrates label_values(log stream selector, label) with template variable as stream and wraps in braces', () => {
    const query = 'label_values($b, label)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'label',
      stream: '{$b}',
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

  it('migrates label_values with bare stream selector and wraps in braces', () => {
    const query = 'label_values(job="scene-logs", program_name)';

    expect(migrateVariableQuery(query)).toStrictEqual({
      refId: 'LokiVariableQueryEditor-VariableQuery',
      type: LokiVariableQueryType.LabelValues,
      label: 'program_name',
      stream: '{job="scene-logs"}',
    });
  });
});
