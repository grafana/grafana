import { jsonDiff } from '../../../settings/version-history/utils';
import { claimCovers, pathKey } from '../types';

import { listItemsOf } from './listKinds';
import { describeNamedList, type ListContext } from './namedLists';

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
    expect(change).toMatchObject({
      text: 'Tag order: changed',
      details: { before: 'Tag "a"\nTag "b"', after: 'Tag "b"\nTag "a"' },
      claims: diffs.map((diff) => pathKey(diff.path)),
    });
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
      'Include All option: turned on',
      'Label: "Env" → "Environment"',
    ]);
    expect(change.claims).toEqual(expect.arrayContaining(['list/0/spec/label', 'list/0/spec/includeAll']));
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
