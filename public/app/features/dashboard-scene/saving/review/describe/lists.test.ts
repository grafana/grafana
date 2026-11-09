import { jsonDiff } from '../../../settings/version-history/utils';
import { claimCovers, pathKey } from '../types';

import { describeNamedList, describeShowHideRules, type ListContext, listItemsOf } from './lists';

// --- Named lists ---

const noDefaults: ListContext = { isDefault: () => false };
const ctx = { fieldConfigLabel: (id: string) => id };

function query(refId: string, expr: string, hidden = false) {
  return {
    kind: 'PanelQuery',
    spec: { refId, hidden, query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', spec: { expr } } },
  };
}

/** Runs the list through jsonDiff, as the summary does, and checks every diff is claimed exactly once. */
function describeList(before: unknown[], after: unknown[], kind: Parameters<typeof listItemsOf>[0] = 'queries') {
  const diffs = Object.values(jsonDiff({ list: before }, { list: after })).flat();
  const changes = describeNamedList(['list'], before, after, diffs, listItemsOf(kind, ctx), noDefaults);
  for (const diff of diffs) {
    const claimedBy = changes.filter((change) => change.claims.some((claim) => claimCovers(claim, pathKey(diff.path))));
    expect(claimedBy).toHaveLength(1);
  }
  // As the corpus renders them: an added or removed element is its name, marked + or −.
  return changes.map((change) => {
    const marker = change.kind === 'added' ? '+ ' : change.kind === 'removed' ? '- ' : '';
    return (change.subject ? marker : '') + change.text;
  });
}

describe('describeNamedList', () => {
  it('reports an appended item as added', () => {
    expect(describeList([query('A', 'up')], [query('A', 'up'), query('B', 'down')])).toEqual(['+ Query "B"']);
  });

  it('matches items by identity, so an insertion at the start shows only the new item', () => {
    expect(describeList([query('A', 'up')], [query('B', 'down'), query('A', 'up')])).toEqual(['+ Query "B"']);
  });

  it('reports a removal from the middle once, without changes on the shifted items', () => {
    const before = [query('A', 'a'), query('B', 'b'), query('C', 'c')];

    expect(describeList(before, [query('A', 'a'), query('C', 'c')])).toEqual(['- Query "B"']);
  });

  it('words a changed field of an item as "<item> › <field>"', () => {
    expect(describeList([query('A', 'up')], [query('A', 'down')])).toEqual(['Query "A" › Query text: up → down']);
    expect(describeList([query('A', 'up')], [query('A', 'up', true)])).toEqual([
      'Query "A" › Hide response: turned on',
    ]);
  });

  it('finds field changes on an item that also moved', () => {
    expect(
      describeList([query('A', 'a'), query('B', 'b')], [query('C', 'c'), query('A', 'a2'), query('B', 'b')])
    ).toEqual(['+ Query "C"', 'Query "A" › Query text: a → a2']);
  });

  it('places a removed item after the item that preceded it in the baseline', () => {
    expect(describeList(['prod', 'staging'], ['prod', 'slo'], 'tags')).toEqual(['- Tag "staging"', '+ Tag "slo"']);
  });

  it('reports a reorder of kept items once', () => {
    const diffs = Object.values(jsonDiff({ list: ['a', 'b'] }, { list: ['b', 'a'] })).flat();
    const [change, ...rest] = describeNamedList(
      ['list'],
      ['a', 'b'],
      ['b', 'a'],
      diffs,
      listItemsOf('tags', ctx),
      noDefaults
    );

    expect(rest).toEqual([]);
    expect(change).toMatchObject({ text: 'Tag order: changed', claims: diffs.map((diff) => pathKey(diff.path)) });
    expect(change.details?.before?.()).toBe('Tag "a"\nTag "b"');
    expect(change.details?.after?.()).toBe('Tag "b"\nTag "a"');
  });

  it('leaves out differences that are only system defaults', () => {
    const before = [{ kind: 'PanelQuery', spec: { refId: 'A', query: { spec: { expr: 'up' } } } }];
    const after = [{ kind: 'PanelQuery', spec: { refId: 'A', hidden: false, query: { spec: { expr: 'up' } } } }];
    const isDefault: ListContext = {
      isDefault: (path, value) => path[path.length - 1] === 'hidden' && value === false,
    };

    expect(describeNamedList(['list'], before, after, [], listItemsOf('queries', ctx), isDefault)).toEqual([]);
  });

  it('names variables by kind, group by as a variable', () => {
    const variable = (kind: string, name: string) => ({ kind, spec: { name } });

    expect(
      describeList(
        [],
        [variable('CustomVariable', 'env'), variable('AdhocVariable', 'filters'), variable('GroupByVariable', 'by')],
        'variables'
      )
    ).toEqual(['+ Custom variable "env"', '+ Ad hoc filters "filters"', '+ Group by variable "by"']);
  });

  it('shows an added variable by its type, with what it is set to but not its resolved options', () => {
    const variable = {
      kind: 'QueryVariable',
      spec: { name: 'query0', query: 'label_values(job)', options: [{ text: 'api', value: 'api' }] },
    };
    const diffs = Object.values(jsonDiff({ list: [] }, { list: [variable] })).flat();
    const [change] = describeNamedList(['list'], [], [variable], diffs, listItemsOf('variables', ctx), noDefaults);

    expect(change).toMatchObject({ kind: 'added', subject: 'variable', text: 'Query variable "query0"' });
    expect(change.properties).toEqual([{ label: 'Query', value: 'label_values(job)' }]);
    expect(change.details).toBeUndefined();
  });

  it('groups several changed fields of one item under its name, each worded without the name', () => {
    const before = { kind: 'CustomVariable', spec: { name: 'env', label: 'Env', includeAll: false } };
    const after = { kind: 'CustomVariable', spec: { name: 'env', label: 'Environment', includeAll: true } };
    const diffs = Object.values(jsonDiff({ list: [before] }, { list: [after] })).flat();
    const [change, ...rest] = describeNamedList(
      ['list'],
      [before],
      [after],
      diffs,
      listItemsOf('variables', ctx),
      noDefaults
    );

    expect(rest).toEqual([]);
    expect(change).toMatchObject({ kind: 'changed', text: 'Custom variable "env"', statusText: '(2 changes)' });
    expect(change.changes?.map((inner) => inner.text)).toEqual([
      'Label: "Env" → "Environment"',
      'Include All option: turned on',
    ]);
    expect(change.claims).toEqual(expect.arrayContaining(['list/0/spec/label', 'list/0/spec/includeAll']));
  });

  it('words a changed variable type as the type picker names it', () => {
    const before = { kind: 'CustomVariable', spec: { name: 'env' } };
    const after = { kind: 'TextVariable', spec: { name: 'env' } };

    expect(describeList([before], [after], 'variables')).toEqual(['Text box variable "env" › Type: Custom → Textbox']);
  });

  it('lists several changed fields of one item in the editor order, whatever order the diff has', () => {
    const before = { kind: 'QueryVariable', spec: { name: 'env', label: '', regex: '', refresh: 'never' } };
    const after = {
      kind: 'QueryVariable',
      spec: { name: 'env', refresh: 'onTimeRangeChanged', regex: '/a/', label: 'Env' },
    };
    const [change] = describeNamedList(
      ['list'],
      [before],
      [after],
      Object.values(jsonDiff({ list: [before] }, { list: [after] })).flat(),
      listItemsOf('variables', ctx),
      noDefaults
    );

    expect(change.changes?.map((inner) => inner.text.split(':')[0])).toEqual(['Label', 'Regex', 'Refresh']);
  });

  it('matches overrides by matcher and words their properties by field config label', () => {
    const override = (unit: string) => ({
      matcher: { id: 'byName', options: 'errors' },
      properties: [{ id: 'unit', value: unit }],
    });

    expect(describeList([override('short')], [override('percent')], 'overrides')).toEqual([
      'Override "errors" › unit: short → percent',
    ]);
  });
});

// --- Show/hide rules ---

const variableRule = (variable: string, operator: string, value: string) => ({
  kind: 'ConditionalRenderingVariable',
  spec: { variable, operator, value },
});
const group = (visibility: string, condition: string, items: unknown[]) => ({
  kind: 'ConditionalRenderingGroup',
  spec: { visibility, condition, items },
});

function lines(before: unknown, after: unknown) {
  const wrap = (value: unknown) => ({ row: { spec: value === undefined ? {} : { conditionalRendering: value } } });
  const diffs = Object.values(jsonDiff(wrap(before), wrap(after))).flat();
  const claims = diffs.map((diff) => pathKey(diff.path));
  const changes = describeShowHideRules('row', before, after, claims, diffs, noDefaults);
  for (const claim of claims) {
    expect(changes.filter((change) => change.claims.some((own) => claimCovers(own, claim)))).toHaveLength(1);
  }
  return changes.map(({ text, kind, subject, details, statusText, properties, categoryNote }) => ({
    text,
    kind,
    subject,
    ...(details && { details: { before: details.before?.(), after: details.after?.() } }),
    ...(statusText && { statusText }),
    ...(properties && { properties }),
    ...(categoryNote && { categoryNote }),
  }));
}

describe('describeShowHideRules', () => {
  it('words visibility and match rules in the editor words', () => {
    const rules = [variableRule('env', 'equals', 'prod')];

    expect(lines(group('show', 'and', rules), group('hide', 'or', rules)).map(({ text }) => text)).toEqual([
      'Row visibility: Show → Hide',
      'Match rules: Match all → Match any',
    ]);
  });

  it('matches rules by variable, not by index', () => {
    const before = group('show', 'and', [
      variableRule('env', 'equals', 'prod'),
      variableRule('region', 'equals', 'eu-west'),
    ]);
    const after = group('show', 'and', [
      variableRule('env', 'matches', 'prod|staging'),
      variableRule('cluster', 'equals', 'blue'),
    ]);

    expect(lines(before, after)).toEqual([
      { text: 'Template variable "env": Equals "prod" → Matches "prod|staging"', kind: 'changed', subject: 'rule' },
      // An added or removed rule says so; how the rules combine is said once, next to the category label
      {
        text: 'Rule removed: Template variable "region" Equals "eu-west"',
        kind: 'removed',
        subject: 'rule',
        categoryNote: '(Match all)',
      },
      {
        text: 'Rule added: Template variable "cluster" Equals "blue"',
        kind: 'added',
        subject: 'rule',
        categoryNote: '(Match all)',
      },
    ]);
  });

  it('shows a time range rule with the editor labels', () => {
    const rule = (value: string) => ({ kind: 'ConditionalRenderingTimeRangeSize', spec: { value } });

    expect(lines(group('hide', 'and', [rule('1h')]), group('hide', 'and', [rule('3h')]))[0].text).toBe(
      'Time range less than: 1 hour → 3 hours'
    );
  });

  it('words a whole rule set added as one line, its settings listed behind it, never JSON', () => {
    const after = group('show', 'and', [{ kind: 'ConditionalRenderingData', spec: { value: true } }]);

    expect(lines(undefined, after)).toEqual([
      {
        text: 'Conditional rendering: added',
        kind: 'added',
        subject: undefined,
        statusText: '(1 rule)',
        properties: [
          { label: 'Row visibility', value: 'Show' },
          { label: 'Match rules', value: 'Match all' },
          { label: 'Query result', value: 'Has data' },
        ],
      },
    ]);
  });
});
