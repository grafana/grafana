import {
  autoGrid,
  autoGridItem,
  customVariable,
  dashboard,
  dataRule,
  edit,
  elements,
  gridOf,
  panel,
  showHideRules,
  tab,
  tabs,
  text,
  timeRangeRule,
  variableRule,
} from '../builders';
import { rowsDashboard } from '../fixtures';
import { type ReviewCorpusCase } from '../types';

const hiddenOnShortRanges = dashboard({
  elements: elements(
    ['panel-1', panel('Requests', { id: 1 })],
    ['panel-2', panel('Errors', { id: 2 })],
    ['panel-3', panel('Latency', { id: 3 })]
  ),
  layout: autoGrid([
    autoGridItem('panel-1'),
    autoGridItem('panel-2', { conditionalRendering: showHideRules('hide', 'and', [timeRangeRule('1h')]) }),
    autoGridItem('panel-3'),
  ]),
});

export const timeRangeRuleChanged: ReviewCorpusCase = {
  name: 'show/hide rules: time range rule changed on an auto grid panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: hiddenOnShortRanges,
    payload: edit(hiddenOnShortRanges, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.items[1].spec.conditionalRendering = showHideRules('hide', 'and', [timeRangeRule('3h')]);
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Time range less than: 1 hour → 3 hours
`,
};

// With a single rule the plain editor label reads clearly.
export const singleRuleVisibilityChanged: ReviewCorpusCase = {
  name: 'show/hide rules: visibility show → hide with a single rule on an auto grid panel',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: edit(hiddenOnShortRanges, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.items[1].spec.conditionalRendering = showHideRules('show', 'and', [timeRangeRule('6h')]);
      }
    }),
    payload: edit(hiddenOnShortRanges, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.items[1].spec.conditionalRendering = showHideRules('hide', 'and', [timeRangeRule('6h')]);
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Errors" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Panel visibility: Show → Hide
`,
};

const ruledRow = edit(rowsDashboard(), (d) => {
  if (d.layout.kind === 'RowsLayout') {
    d.layout.spec.rows[0].spec.conditionalRendering = showHideRules('show', 'and', [
      variableRule('env', 'equals', 'prod'),
      dataRule(true),
    ]);
  }
});

// A panel's own layout setting and its show/hide rules land in their own categories, Layout first.
export const panelRuleSetAddedWithLayoutChange: ReviewCorpusCase = {
  name: 'show/hide rules: rule set added to an auto grid panel next to a layout change',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: hiddenOnShortRanges,
    payload: edit(hiddenOnShortRanges, (d) => {
      if (d.layout.kind === 'AutoGridLayout') {
        d.layout.spec.items[2].spec.fitContent = true;
        d.layout.spec.items[2].spec.conditionalRendering = showHideRules('hide', 'and', [
          variableRule('env', 'equals', 'prod'),
        ]);
      }
    }),
  },
  expected: text`
Changes to 1 panel
Counts: 1 added, 1 changed, 0 removed, 0 moved

Panel "Latency" was updated (2 changes) · layout, conditional rendering
  [Layout]
    Fit content: turned on
  [Conditional rendering]
    Conditional rendering: added (1 rule)
      · Panel visibility: Hide
      · Match rules: Match all
      · Template variable "env": Equals "prod"
`,
};

export const visibilityAndMatchChanged: ReviewCorpusCase = {
  name: 'show/hide rules: row visibility show → hide, match all → any',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: ruledRow,
    payload: edit(ruledRow, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.conditionalRendering = showHideRules('hide', 'or', [
          variableRule('env', 'equals', 'prod'),
          dataRule(true),
        ]);
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 0 added, 2 changed, 0 removed, 0 moved

Row "API" was updated (2 changes) · conditional rendering
  [Conditional rendering]
    Row visibility when the rules match: Show → Hide
    Match rules: Match all → Match any
`,
};

const variableRules = edit(
  rowsDashboard({
    variables: [
      customVariable('env', ['prod', 'staging']),
      customVariable('region', ['eu-west', 'us-east']),
      customVariable('cluster', ['blue', 'green']),
    ],
  }),
  (d) => {
    if (d.layout.kind === 'RowsLayout') {
      d.layout.spec.rows[1].spec.conditionalRendering = showHideRules('show', 'and', [
        variableRule('env', 'equals', 'prod'),
        variableRule('region', 'equals', 'eu-west'),
      ]);
    }
  }
);

// Rules are identified by variable name: removing 'region' and adding 'cluster' in its place is not a change of rule 2.
export const variableRulesAddedRemovedChanged: ReviewCorpusCase = {
  name: 'show/hide rules: variable rules added, removed and changed, matched by variable',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: variableRules,
    payload: edit(variableRules, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[1].spec.conditionalRendering = showHideRules('show', 'and', [
          variableRule('env', 'matches', 'prod|staging'),
          variableRule('cluster', 'equals', 'blue'),
        ]);
      }
    }),
  },
  expected: text`
Changes to 1 row
Counts: 1 added, 1 changed, 1 removed, 0 moved

Row "DB" was updated (3 changes) · conditional rendering
  [Conditional rendering (Match all)]
    Template variable "env": Equals "prod" → Matches "prod|staging"
    - Rule removed: Template variable "region" Equals "eu-west"
    + Rule added: Template variable "cluster" Equals "blue"
`,
};

const tabbed = dashboard({
  elements: elements(['panel-1', panel('Requests', { id: 1 })], ['panel-2', panel('Queries', { id: 2 })]),
  layout: tabs([tab('API', gridOf('panel-1')), tab('DB', gridOf('panel-2'))]),
});

export const ruleSetAddedToTab: ReviewCorpusCase = {
  name: 'show/hide rules: rule set added to a tab (readable details, no JSON)',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabbed,
    payload: edit(tabbed, (d) => {
      if (d.layout.kind === 'TabsLayout') {
        d.layout.spec.tabs[1].spec.conditionalRendering = showHideRules('show', 'and', [dataRule(true)]);
      }
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 1 added, 0 changed, 0 removed, 0 moved

Tab "DB" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Conditional rendering: added (1 rule)
      · Tab visibility: Show
      · Match rules: Match all
      · Query result: Has data
`,
};

const tabWithRules = edit(tabbed, (d) => {
  if (d.layout.kind === 'TabsLayout') {
    d.layout.spec.tabs[1].spec.conditionalRendering = showHideRules('hide', 'or', [
      dataRule(false),
      timeRangeRule('7d'),
    ]);
  }
});

export const ruleSetRemovedFromTab: ReviewCorpusCase = {
  name: 'show/hide rules: rule set removed from a tab',
  input: {
    mode: 'save',
    baselineKind: 'saved',
    baseline: tabWithRules,
    payload: edit(tabWithRules, (d) => {
      if (d.layout.kind === 'TabsLayout') {
        delete d.layout.spec.tabs[1].spec.conditionalRendering;
      }
    }),
  },
  expected: text`
Changes to 1 tab
Counts: 0 added, 0 changed, 1 removed, 0 moved

Tab "DB" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Conditional rendering: removed (2 rules)
      · Tab visibility when the rules match: Hide
      · Match rules: Match any
      · Query result: No data
      · Time range less than: 7 days
`,
};
