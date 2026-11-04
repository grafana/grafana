import { standardTransformersRegistry } from '@grafana/data';
import {
  type ConditionalRenderingGroupSpec,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import nestedDashboardJson from '../../serialization/testfiles/nested_dashboard.json';
import { jsonDiff } from '../../settings/version-history/utils';

import {
  autoGrid,
  autoGridItem,
  customVariable,
  dashboard,
  edit,
  elements,
  gridItem,
  gridOf,
  libraryPanel,
  normalize,
  panel,
  panelSpecOf,
  query,
  row,
  rows,
  text,
} from './__corpus__/builders';
import {
  checkCompleteness,
  collectClaims,
  diffPathKeys,
  formatCompletenessReport,
  isComplete,
} from './__corpus__/completeness';
import { gridDashboard, rowsDashboard } from './__corpus__/fixtures';
import { getPluginLoader } from './__corpus__/plugins';
import { type CorpusPluginId } from './__corpus__/types';
import { emptyBaselineFor } from './describe/emptyBaseline';
import { renderReviewText } from './renderReviewText';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';
import { type ReviewInput } from './types';

/*
 * Edge cases found during QA of the Review tab. Each test asserts the rendered text and that every jsonDiff
 * path is claimed exactly once.
 */

standardTransformersRegistry.setInit(getStandardTransformers);

type Input = Omit<ReviewInput, 'getPlugin'> & { plugins?: CorpusPluginId[] };

function review({ plugins, ...input }: Input) {
  const summary = summarizeDashboardChanges({ ...input, getPlugin: getPluginLoader(plugins) });
  const diffs = jsonDiff(input.baseline ?? emptyBaselineFor(input.payload), input.payload);
  const report = checkCompleteness(diffPathKeys(diffs), collectClaims(summary));
  return { summary, text: renderReviewText(summary), report };
}

function expectReview(input: Input, expected: string) {
  const { text: actual, report } = review(input);
  expect(actual).toBe(expected);
  expect(formatCompletenessReport(report)).toBe('');
  expect(isComplete(report)).toBe(true);
}

function save(baseline: DashboardV2Spec, payload: DashboardV2Spec): Input {
  return { mode: 'save', baselineKind: 'saved', baseline, payload };
}

function inRows(
  spec: DashboardV2Spec,
  recipe: (rowsSpec: Array<{ spec: { title?: string; layout: unknown } }>) => void
) {
  if (spec.layout.kind !== 'RowsLayout') {
    throw new Error('qa: expected a rows layout');
  }
  recipe(spec.layout.spec.rows);
}

describe('Review QA edge cases', () => {
  describe('structure', () => {
    it('describes two panels swapped between rows as two moves', () => {
      const baseline = rowsDashboard();
      const payload = edit(baseline, (d) =>
        inRows(d, ([api, db]) => {
          api.spec.layout = gridOf('panel-3', 'panel-2');
          db.spec.layout = gridOf('panel-1', 'panel-4');
        })
      );

      expectReview(
        save(baseline, payload),
        text`
Changes to 2 panels
Counts: 0 added, 0 changed, 0 removed, 2 moved

Row "API"
  Panel "Queries" moved from Row "DB" to Row "API", before Panel "Errors"

Row "DB"
  Panel "Requests" moved from Row "API" to Row "DB", before Panel "Connections"
`
      );
    });

    it('matches a renamed row by position when a panel was also added to it', () => {
      const baseline = rowsDashboard();
      const payload = edit(baseline, (d) => {
        d.elements['panel-9'] = panel('Saturation', { id: 9 });
        inRows(d, ([api]) => {
          api.spec.title = 'Gateway';
          api.spec.layout = gridOf('panel-1', 'panel-2', 'panel-9');
        });
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 1 section and 1 panel
Counts: 1 added, 1 changed, 0 removed, 0 moved

Row "Gateway" was updated (1 change) · properties
  [Properties]
    Title: "API" → "Gateway"
  + Panel "Saturation"
`
      );
    });

    it('treats a renamed row that kept fewer than half of its panels as removed and added', () => {
      const baseline = rowsDashboard();
      const payload = edit(baseline, (d) => {
        d.elements['panel-8'] = panel('Saturation', { id: 8 });
        d.elements['panel-9'] = panel('Utilization', { id: 9 });
        inRows(d, ([api, db]) => {
          api.spec.title = 'Gateway';
          api.spec.layout = gridOf('panel-1', 'panel-8', 'panel-9');
          db.spec.layout = gridOf('panel-3', 'panel-4', 'panel-2');
        });
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 2 sections and 4 panels
Counts: 3 added, 0 changed, 1 removed, 2 moved

- Row "API"

+ Row "Gateway"
  Panel "Requests" moved from Row "API" to Row "Gateway", before Panel "Saturation"
  + Panel "Saturation"
  + Panel "Utilization"

Row "DB"
  Panel "Errors" moved from Row "API" to Row "DB", after Panel "Connections"
`
      );
    });

    it('names rows with an empty and a missing title alike, by position', () => {
      const baseline = dashboard({
        elements: elements(['panel-1', panel('A', { id: 1 })], ['panel-2', panel('B', { id: 2 })]),
        layout: rows([row('', gridOf('panel-1')), row(undefined, gridOf('panel-2'))]),
      });
      const payload = edit(baseline, (d) => {
        panelSpecOf(d, 'panel-1').title = 'A2';
        panelSpecOf(d, 'panel-2').title = 'B2';
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 2 panels
Counts: 0 added, 2 changed, 0 removed, 0 moved

Row (unnamed) at position 1
  Panel "A2" was updated (1 change) · properties
    [Properties]
      Title: "A" → "A2"

Row (unnamed) at position 2
  Panel "B2" was updated (1 change) · properties
    [Properties]
      Title: "B" → "B2"
`
      );
    });

    // Both mean "no title", so nothing visible changed.
    it('does not show "undefined" when a row title goes from empty to missing', () => {
      const baseline = dashboard({
        elements: elements(['panel-1', panel('A', { id: 1 })]),
        layout: rows([row('', gridOf('panel-1'))]),
      });
      const payload = edit(baseline, (d) =>
        inRows(d, ([first]) => {
          first.spec.title = undefined;
        })
      );

      const { text: actual, report } = review(save(baseline, payload));
      expect(isComplete(report)).toBe(true);
      expect(actual).not.toContain('undefined');
    });
  });

  describe('panels and lists', () => {
    it('names a panel whose title was emptied by position', () => {
      const baseline = gridDashboard();
      const payload = edit(baseline, (d) => {
        panelSpecOf(d, 'panel-1').title = '';
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel (unnamed) was updated (1 change) · properties
  [Properties]
    Title: cleared (was "Requests")
`
      );
    });

    it('keeps duplicate query ref IDs complete when the second one changes', () => {
      const baseline = edit(gridDashboard(), (d) => {
        panelSpecOf(d, 'panel-1').data.spec.queries = [query('A', 'up'), query('A', 'down')];
      });
      const payload = edit(baseline, (d) => {
        panelSpecOf(d, 'panel-1').data.spec.queries = [query('A', 'up'), query('A', 'sideways')];
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Requests" was updated (1 change) · data
  [Data]
    Query "A" › Query text: down → sideways
`
      );
    });

    it('describes a renamed variable as a removal and an addition', () => {
      const baseline = rowsDashboard();
      const payload = edit(baseline, (d) => {
        d.variables = [customVariable('environment', ['prod', 'staging'])];
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to the dashboard
Counts: 1 added, 0 changed, 1 removed, 0 moved

Dashboard was updated (2 changes) · controls
  [Controls]
    - Custom variable "env"
      before: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "prod",
              "value": "prod"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "env",
            "query": "prod,staging",
            "skipUrlSync": false
          }
        }
      after: (none)
    + Custom variable "environment"
      before: (none)
      after: {
          "kind": "CustomVariable",
          "spec": {
            "allowCustomValue": true,
            "current": {
              "text": "prod",
              "value": "prod"
            },
            "hide": "dontHide",
            "includeAll": false,
            "multi": false,
            "name": "environment",
            "query": "prod,staging",
            "skipUrlSync": false
          }
        }
`
      );
    });

    const withLibraryPanel = edit(gridDashboard(), (d) => {
      d.elements['panel-4'] = libraryPanel('Shared', 'Shared lib', 'lib-1', 4);
      if (d.layout.kind === 'GridLayout') {
        d.layout.spec.items.push(gridItem('panel-4', { x: 12, y: 8, w: 12, h: 8 }));
      }
    });

    it('describes a removed library panel by its title', () => {
      const payload = edit(withLibraryPanel, (d) => {
        delete d.elements['panel-4'];
        if (d.layout.kind === 'GridLayout') {
          d.layout.spec.items.pop();
        }
      });

      expectReview(
        save(withLibraryPanel, payload),
        text`
Changes to 1 panel
Counts: 0 added, 0 changed, 1 removed, 0 moved

- Panel "Shared"
`
      );
    });

    it('describes a library panel unlinked into a regular panel as one change', () => {
      const payload = edit(withLibraryPanel, (d) => {
        d.elements['panel-4'] = panel('Shared', { id: 4 });
      });

      expectReview(
        save(withLibraryPanel, payload),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Shared" was updated (1 change) · properties
  [Properties]
    Unlinked from library panel "Shared lib"
`
      );
    });

    it('shows nothing when a panel is renamed and renamed back', () => {
      const baseline = gridDashboard();
      const renamed = edit(baseline, (d) => {
        panelSpecOf(d, 'panel-1').title = 'Something else';
      });
      const payload = edit(renamed, (d) => {
        panelSpecOf(d, 'panel-1').title = 'Requests';
      });

      expectReview(save(baseline, payload), 'No changes to save');
    });
  });

  describe('round 5 wording', () => {
    const twins = () =>
      dashboard({
        elements: elements(
          ['panel-1', panel('New panel', { id: 1 })],
          ['panel-2', panel('New panel', { id: 2 })],
          ['panel-3', panel('Latency', { id: 3 })]
        ),
        layout: autoGrid([autoGridItem('panel-1'), autoGridItem('panel-2'), autoGridItem('panel-3')]),
      });

    it('names a moved and updated duplicate-titled panel by its new position', () => {
      const baseline = twins();
      const payload = edit(baseline, (d) => {
        panelSpecOf(d, 'panel-2').transparent = true;
        if (d.layout.kind === 'AutoGridLayout') {
          const [a, b, c] = d.layout.spec.items;
          d.layout.spec.items = [a, c, b];
        }
      });

      // Ties in the order diff keep the baseline-first panel in place, so "Latency" is the one that moved.
      // The neighbour is named without a position (§3), which is ambiguous here: both twins read "New panel".
      expectReview(
        save(baseline, payload),
        text`
Changes to 2 panels
Counts: 0 added, 1 changed, 0 removed, 1 moved

Panel "Latency" moved after Panel "New panel"

Panel "New panel" at position 3 was updated (1 change) · properties
  [Properties]
    Transparent background: turned on
`
      );
    });

    it('describes an unconfigured panel switched to a visualization', () => {
      const baseline = dashboard({
        elements: elements([
          'panel-1',
          panel('New panel', { id: 1, viz: '__unconfigured-panel', options: {}, fieldConfigDefaults: {} }),
        ]),
        layout: autoGrid([autoGridItem('panel-1')]),
      });
      const payload = edit(baseline, (d) => {
        const viz = panelSpecOf(d, 'panel-1').vizConfig;
        viz.group = 'stat';
        viz.spec.options = { colorMode: 'value', graphMode: 'area', justifyMode: 'auto', textMode: 'auto' };
      });

      expectReview(
        { ...save(baseline, payload), plugins: ['stat'] },
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "New panel" was updated (1 change) · visualization
  [Visualization]
    Visualization: set to Stat

System defaults (1)
  Panel "New panel"
    Plugin options: set to the Stat defaults
`
      );
    });
  });

  describe('save flows', () => {
    it('ignores an undefined description in a Save As payload, as getSaveAsModel builds it', () => {
      const baseline = gridDashboard();
      const payload: DashboardV2Spec = {
        ...edit(baseline, (d) => {
          panelSpecOf(d, 'panel-1').title = 'Requests 2';
        }),
        title: 'Service overview Copy',
        description: undefined,
        tags: [],
      };

      expectReview(
        { mode: 'saveAsCopy', baselineKind: 'saved', baseline, payload, sourceTitle: baseline.title },
        text`
Copy of "Service overview"
Changes to the dashboard and 1 panel
Counts: 0 added, 2 changed, 0 removed, 0 moved

Dashboard was updated (1 change) · properties
  [Properties]
    Title: "Service overview" → "Service overview Copy"

Panel "Requests 2" was updated (1 change) · properties
  [Properties]
    Title: "Requests" → "Requests 2"
`
      );
    });

    // The serializer omits auto grid settings left at their defaults, so a new dashboard must not report them.
    it('does not report auto grid settings the new dashboard never set', () => {
      const payload = dashboard({
        elements: elements(['panel-1', panel('A', { id: 1 })]),
        layout: autoGrid([autoGridItem('panel-1')]),
      });

      const { text: actual, report } = review({ mode: 'new', baselineKind: 'saved', baseline: null, payload });

      expect(isComplete(report)).toBe(true);
      expect(actual).not.toContain('Fill screen');
      expect(actual).not.toContain('Fit content');
      expect(actual).not.toContain('Match row heights');
    });
  });

  describe('show / hide rules on an auto grid panel', () => {
    const rule = (
      items: ConditionalRenderingGroupSpec['items'],
      extra: Partial<ConditionalRenderingGroupSpec> = {}
    ) => ({
      kind: 'ConditionalRenderingGroup' as const,
      spec: { visibility: 'show' as const, condition: 'and' as const, items, ...extra },
    });
    const timeRange = (value: string) => ({ kind: 'ConditionalRenderingTimeRangeSize' as const, spec: { value } });
    const variableRule = (variable: string, value: string) => ({
      kind: 'ConditionalRenderingVariable' as const,
      spec: { variable, operator: 'equals' as const, value },
    });
    const withRules = (conditionalRendering: ReturnType<typeof rule>) =>
      dashboard({
        elements: elements(['panel-1', panel('Latency', { id: 1 })], ['panel-2', panel('Errors', { id: 2 })]),
        layout: autoGrid([autoGridItem('panel-1', { conditionalRendering }), autoGridItem('panel-2')]),
      });

    it('words a rule of an auto grid panel inside a row the same way', () => {
      const inRow = (conditionalRendering: ReturnType<typeof rule>) =>
        dashboard({
          elements: elements(['panel-1', panel('Latency', { id: 1 })], ['panel-2', panel('Errors', { id: 2 })]),
          layout: rows([
            row('Memory', autoGrid([autoGridItem('panel-1', { conditionalRendering }), autoGridItem('panel-2')])),
          ]),
        });

      expectReview(
        save(inRow(rule([timeRange('6h')])), inRow(rule([timeRange('3h')]))),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Row "Memory"
  Panel "Latency" was updated (1 change) · conditional rendering
    [Conditional rendering]
      Time range less than: 6 hours → 3 hours
`
      );
    });

    // The product owner's scenario: a "Time range less than" rule changed from 1 hour to 3 hours.
    it("words a changed time range rule in the editor's words", () => {
      expectReview(
        save(withRules(rule([timeRange('1h')])), withRules(rule([timeRange('3h')]))),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Latency" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Time range less than: 1 hour → 3 hours
`
      );
    });

    it('says just "Panel visibility" when there is a single rule', () => {
      expectReview(
        save(withRules(rule([timeRange('1h')])), withRules(rule([timeRange('1h')], { visibility: 'hide' }))),
        text`
Changes to 1 panel
Counts: 0 added, 1 changed, 0 removed, 0 moved

Panel "Latency" was updated (1 change) · conditional rendering
  [Conditional rendering]
    Panel visibility: Show → Hide
`
      );
    });

    it('lists a collapsed row under Properties', () => {
      const baseline = rowsDashboard();
      const payload = edit(baseline, (d) => {
        if (d.layout.kind === 'RowsLayout') {
          d.layout.spec.rows[1].spec.collapse = true;
        }
      });

      expectReview(
        save(baseline, payload),
        text`
Changes to 1 section
Counts: 0 added, 1 changed, 0 removed, 0 moved

Row "DB" was updated (1 change) · properties
  [Properties]
    Row: collapsed
`
      );
    });

    it('words visibility, match rules and an added variable rule granularly', () => {
      expectReview(
        save(
          withRules(rule([timeRange('1h')])),
          withRules(rule([timeRange('1h'), variableRule('cluster', 'blue')], { visibility: 'hide', condition: 'or' }))
        ),
        text`
Changes to 1 panel
Counts: 1 added, 2 changed, 0 removed, 0 moved

Panel "Latency" was updated (3 changes) · conditional rendering
  [Conditional rendering]
    Panel visibility when the rules match: Show → Hide
    Match rules: Match all → Match any
    + Template variable "cluster" Equals "blue"
`
      );
    });
  });

  describe('real dashboard: nested rows and tabs', () => {
    const nested = normalize(nestedDashboardJson as unknown as DashboardV2Spec);

    it('has no changes against itself', () => {
      expectReview(
        save(
          nested,
          edit(nested, () => {})
        ),
        'No changes to save'
      );
    });

    it('describes a rename, a move between nested tabs, a removed nested row and a renamed empty tab', () => {
      const payload = edit(nested, (d) => {
        panelSpecOf(d, 'panel-4').title = 'Renamed';
        delete d.elements['panel-6'];
        // The fixture's nesting is deeper than the builders' types follow; walk it as plain JSON.
        const layout = JSON.parse(JSON.stringify(d.layout));
        const [credit, cpu] = layout.spec.rows;
        const [creditUsage, ec2CreditUsage] = credit.spec.layout.spec.rows;
        creditUsage.spec.layout.spec.tabs[1].spec.title = 'us-west-1';
        ec2CreditUsage.spec.layout.spec.rows = [];
        const [cw, testData] = cpu.spec.layout.spec.rows[0].spec.layout.spec.tabs;
        cw.spec.layout.spec.items = [];
        testData.spec.layout.spec.items.push(autoGridItem('panel-12'));
        d.layout = layout;
      });

      expectReview(
        save(nested, payload),
        text`
Changes to 2 sections and 2 panels
Counts: 0 added, 2 changed, 1 removed, 1 moved

Row "Credit" › Row "Credit Usage" › Tab "us-east-1"
  Panel "Renamed" was updated (1 change) · properties
    [Properties]
      Title: "EC2 Credit Usage for one instance" → "Renamed"

Row "Credit" › Row "Credit Usage" › Tab "us-west-1" was updated (1 change) · properties
  [Properties]
    Title: "us-east-2" → "us-west-1"

- Row "Credit" › Row "EC2 credit usage" › Row "duplicated CPU"
  removed with it: Panel "EC2 Credit Usage for one instance"

Row "CPU" › Row "GF-ds" › Tab "tab with test data"
  Panel "GF datasource" moved from Row "CPU" › Row "GF-ds" › Tab "CW" to Row "CPU" › Row "GF-ds" › Tab "tab with test data", after Panel "random 1"
`
      );
    });
  });

  describe('large dashboard', () => {
    const ROWS = 15;
    const PER_ROW = 10;
    const names = Array.from({ length: ROWS * PER_ROW }, (_, i) => `panel-${i + 1}`);
    const baseline = dashboard({
      elements: elements(
        ...names.map((name, i): [string, ReturnType<typeof panel>] => [
          name,
          panel(`Node ${i + 1}`, { id: i + 1, queries: [query('A', `up{n="${i}"}`), query('B', `down{n="${i}"}`)] }),
        ])
      ),
      layout: rows(
        Array.from({ length: ROWS }, (_, r) =>
          row(`Row ${r + 1}`, gridOf(...names.slice(r * PER_ROW, (r + 1) * PER_ROW)))
        )
      ),
    });

    // 150 panels: 120 retitled with a query changed (5 of them also moved to the next row), 10 removed,
    // 10 added, one row renamed.
    const payload = edit(baseline, (d) => {
      names.slice(0, 120).forEach((name, i) => {
        const spec = panelSpecOf(d, name);
        spec.title = `Host ${i + 1}`;
        spec.data.spec.queries[1] = query('B', `sideways{n="${i}"}`);
      });
      names.slice(140).forEach((name) => delete d.elements[name]);
      for (let i = 0; i < 10; i++) {
        d.elements[`new-${i}`] = panel(`New ${i}`, { id: 1000 + i });
      }
      inRows(d, (rowsSpec) => {
        const groups = Array.from({ length: ROWS }, (_, r) => names.slice(r * PER_ROW, (r + 1) * PER_ROW));
        for (let r = 0; r < 5; r++) {
          const [first] = groups[r].splice(0, 1);
          groups[r + 1].push(first);
        }
        groups[ROWS - 1] = groups[ROWS - 1].filter((name) => d.elements[name]);
        groups[ROWS - 1].push(...Array.from({ length: 10 }, (_, i) => `new-${i}`));
        rowsSpec.forEach((rowSpec, r) => {
          rowSpec.spec.layout = gridOf(...groups[r]);
        });
        rowsSpec[3].spec.title = 'Renamed row';
      });
    });

    it('stays complete, collapses panels and finishes quickly', () => {
      const started = performance.now();
      const summary = summarizeDashboardChanges({ ...save(baseline, payload) });
      const elapsed = performance.now() - started;
      // Printed for the QA report; the bound is loose so it doesn't flake on slow CI machines.
      process.stdout.write(`summarizeDashboardChanges, 150 panels, 140 changed: ${elapsed.toFixed(0)} ms\n`);

      const diffs = jsonDiff(baseline, payload);
      const report = checkCompleteness(diffPathKeys(diffs), collectClaims(summary));
      expect(formatCompletenessReport(report)).toBe('');
      expect(summary.collapsePanelsByDefault).toBe(true);
      // 120 titles + 120 queries + 1 row title + 45 positions of panels that slid up after a move out of their row.
      expect(summary.overview.counts).toEqual({ added: 10, changed: 286, removed: 10, moved: 5 });
      expect(renderReviewText(summary)).toContain(text`
Row "Renamed row" was updated (1 change) · properties
  [Properties]
    Title: "Row 4" → "Renamed row"
`);
      expect(renderReviewText(summary)).toContain(
        'Panel "Host 1" moved from Row "Row 1" to Row "Row 2", after Panel "Host 20" and was updated (2 changes) · properties, data'
      );
      expect(summary.overview.line).toBe('Changes to 1 section and 140 panels');
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
