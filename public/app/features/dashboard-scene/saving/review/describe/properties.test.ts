import {
  defaultAdhocVariableKind,
  defaultAnnotationQueryKind,
  defaultConstantVariableKind,
  defaultCustomVariableKind,
  defaultDashboardLink,
  defaultDatasourceVariableKind,
  defaultGroupByVariableKind,
  defaultIntervalVariableKind,
  defaultQueryVariableKind,
  defaultSwitchVariableKind,
  defaultTextVariableKind,
  type Spec as DashboardV2Spec,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  libraryPanel,
  panel,
  query,
  row,
  rows,
  tab,
  tabs,
  transformation,
} from '../__corpus__/builders';
import { addedPanelProperties } from '../__corpus__/cases/addedElementProperties';
import { getPluginLoader } from '../__corpus__/plugins';
import { richToPlain } from '../richText';
import { summarizeDashboardChanges } from '../summarizeDashboardChanges';
import { type PanelReviewNode, type ReviewChange, type ReviewNode, type ReviewSummary } from '../types';

import { property, recordProperties, withoutDefaults } from './properties';

const noDefaults = () => false;

describe('withoutDefaults', () => {
  it('drops defaults, false and empty values at any depth, and is undefined when nothing is left', () => {
    const isDefault = (path: string[]) => path.join('/') === 'root/mode';
    const value = { mode: 'standard', legend: { show: false, calcs: [] }, unit: 'ms', nested: { empty: '' } };

    expect(withoutDefaults(value, ['root'], isDefault)).toEqual({ unit: 'ms' });
    expect(withoutDefaults({ mode: 'standard' }, ['root'], isDefault)).toBeUndefined();
  });

  it('keeps every array item, so a list keeps its count', () => {
    expect(withoutDefaults([{ hidden: false }, { refId: 'B' }], ['list'], noDefaults)).toEqual([{}, { refId: 'B' }]);
  });
});

describe('property', () => {
  it('shows literal values inline: text quoted when typed, numbers as is, true as Yes', () => {
    expect(property('Description', 'Cache hits', { quoted: true })).toEqual({
      label: 'Description',
      value: '"Cache hits"',
    });
    expect(property('Max data points', 500)).toEqual({ label: 'Max data points', value: '500' });
    expect(property('Multi-value', true)).toEqual({ label: 'Multi-value', value: 'Yes' });
  });

  it('leaves out what is not set', () => {
    expect(property('Description', '')).toBeUndefined();
    expect(property('Transparent', false)).toBeUndefined();
    expect(property('Links', [])).toBeUndefined();
  });

  it('shows a few short names inline and anything else as JSON behind Show, with a count for lists', () => {
    expect(property('Tags', ['prod', 'eu'])).toEqual({ label: 'Tags', value: '"prod", "eu"' });
    expect(property('Queries', [{ refId: 'A' }])).toEqual({
      label: 'Queries (1)',
      details: JSON.stringify([{ refId: 'A' }], null, 2),
    });
    expect(property('Options', { a: 1 })).toEqual({ label: 'Options', details: '{\n  "a": 1\n}' });
    expect(property('Query', 'line 1\nline 2')).toEqual({ label: 'Query', details: 'line 1\nline 2' });
  });
});

describe('recordProperties', () => {
  it('lists the keys of a record in order, with known labels, humanized otherwise, and skips some', () => {
    const record = { name: 'env', label: 'Environment', includeAll: true, allowCustomValue: false };

    expect(
      recordProperties(record, ['spec'], noDefaults, {
        labels: { label: 'Label' },
        formats: { label: { quoted: true } },
        skip: ['name'],
      })
    ).toEqual([
      { label: 'Label', value: '"Environment"' },
      { label: 'Include all', value: 'Yes' },
    ]);
  });
});

describe('an added panel', () => {
  it('shows only the field config it was given, not what the plugin fills in', () => {
    const { plugins, ...input } = addedPanelProperties.input;
    const summary = summarizeDashboardChanges({ ...input, getPlugin: getPluginLoader(plugins) });
    const node = summary.tree.find((candidate): candidate is PanelReviewNode => candidate.kind === 'panel');

    const fieldConfig = node?.properties?.find((item) => item.label === 'Field config');
    expect(JSON.parse(fieldConfig?.details ?? '')).toEqual({ defaults: { unit: 'percent' } });
  });
});

describe('every added or removed element is reviewable', () => {
  // Each element at its schema defaults: nothing differs, so what it is set to must still be listed.
  const variables: VariableKind[] = [
    defaultQueryVariableKind(),
    defaultCustomVariableKind(),
    defaultAdhocVariableKind(),
    defaultGroupByVariableKind(),
    defaultDatasourceVariableKind(),
    defaultIntervalVariableKind(),
    defaultTextVariableKind(),
    defaultConstantVariableKind(),
    defaultSwitchVariableKind(),
  ];
  variables.forEach((variable, index) => {
    variable.spec.name = `v${index}`;
  });
  const full = dashboard({
    variables,
    annotations: [{ ...defaultAnnotationQueryKind(), spec: { ...defaultAnnotationQueryKind().spec, name: 'Notes' } }],
    links: [{ ...defaultDashboardLink(), title: 'Docs' }],
    elements: elements(
      ['panel-1', panel('P1', { id: 1, queries: [query('A', 'up'), query('B', 'down')] })],
      ['panel-2', libraryPanel('Shared', 'Shared lib', 'lib-1', 2)]
    ),
    layout: tabs([
      tab('', rows([row('', autoGrid([autoGridItem('panel-1')])), row('R', autoGrid([autoGridItem('panel-2')]))])),
    ]),
  });
  const empty = dashboard({ annotations: [] });
  const withPanelItems = edit(full, (d) => {
    const spec = d.elements['panel-1'].spec;
    if ('data' in spec) {
      spec.data.spec.transformations = [transformation('organize')];
      spec.vizConfig.spec.fieldConfig.overrides = [
        { matcher: { id: 'byName', options: 'errors' }, properties: [{ id: 'unit', value: 'ms' }] },
      ];
    }
  });

  /** Added or removed nodes and element lines whose toggle would reveal nothing. */
  function unreviewable(summary: ReviewSummary): string[] {
    const missing: string[] = [];
    const visitChange = (change: ReviewChange) => {
      const element = change.subject && change.subject !== 'tag' && change.subject !== 'rule';
      if (element && (change.kind === 'added' || change.kind === 'removed') && !change.properties?.length) {
        missing.push(change.text);
      }
      change.changes?.forEach(visitChange);
    };
    const visit = (node: ReviewNode) => {
      // A section is reviewable through what it holds too: its panels, what moved to it or was removed with it.
      const holds =
        node.kind === 'section' &&
        (node.children.length > 0 || Boolean(node.movedInContents?.length || node.removedContents?.length));
      if ((node.status === 'added' || node.status === 'removed') && !node.properties?.length && !holds) {
        missing.push(richToPlain(node.label));
      }
      node.categories.forEach((group) => group.changes.forEach(visitChange));
      if (node.kind === 'section') {
        node.children.forEach(visit);
      }
    };
    summary.tree.forEach(visit);
    return missing;
  }

  const summarize = (baseline: DashboardV2Spec, payload: DashboardV2Spec) =>
    summarizeDashboardChanges({ mode: 'save', baselineKind: 'saved', baseline, payload });

  it('lists what each added element is set to, even when it is all defaults', () => {
    expect(unreviewable(summarize(empty, full))).toEqual([]);
  });

  it('lists what each removed element was set to, even when it was all defaults', () => {
    expect(unreviewable(summarize(full, empty))).toEqual([]);
  });

  it('lists what added and removed queries, transformations and overrides are set to', () => {
    expect(unreviewable(summarize(full, withPanelItems))).toEqual([]);
    expect(unreviewable(summarize(withPanelItems, full))).toEqual([]);
  });

  it('lists a switch variable at its defaults by what it is set to', () => {
    const summary = summarize(
      empty,
      edit(empty, (d) => void (d.variables = [variables[8]]))
    );
    const [change] = summary.tree[0].categories[0].changes;

    expect(change.text).toBe('Switch variable "v8"');
    expect(change.properties?.length).toBeGreaterThan(0);
  });
});
