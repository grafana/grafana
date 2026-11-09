import { standardTransformersRegistry } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { jsonDiff } from '../../settings/version-history/utils';

import {
  autoGrid,
  autoGridItem,
  dashboard,
  edit,
  elements,
  gridOf,
  panel,
  panelSpecOf,
  query,
  row,
  rows,
  text,
} from './__corpus__/builders';
import { checkCompleteness, collectClaims, diffPathKeys, formatCompletenessReport } from './__corpus__/completeness';
import { renderReviewText } from './__corpus__/renderReviewText';
import { emptyBaselineFor } from './describe/paths';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';
import { type ReviewInput } from './types';

/*
 * Edge cases found during QA of the Review tab whose checks don't fit a corpus case (an expected text):
 * each one asserts that every jsonDiff path is claimed exactly once, plus its own checks.
 * The rest of the QA edge cases live in the corpus.
 */

standardTransformersRegistry.setInit(getStandardTransformers);

function review(input: ReviewInput) {
  const summary = summarizeDashboardChanges(input);
  const diffs = jsonDiff(input.baseline ?? emptyBaselineFor(input.payload), input.payload);
  const report = checkCompleteness(diffPathKeys(diffs), collectClaims(summary));
  return { summary, text: renderReviewText(summary), report };
}

function save(baseline: DashboardV2Spec, payload: DashboardV2Spec): ReviewInput {
  return { mode: 'save', baselineKind: 'saved', baseline, payload };
}

describe('Review QA edge cases', () => {
  // Both mean "no title", so nothing visible changed.
  it('does not show "undefined" when a row title goes from empty to missing', () => {
    const baseline = dashboard({
      elements: elements(['panel-1', panel('A', { id: 1 })]),
      layout: rows([row('', gridOf('panel-1'))]),
    });
    const payload = edit(baseline, (d) => {
      if (d.layout.kind === 'RowsLayout') {
        d.layout.spec.rows[0].spec.title = undefined;
      }
    });

    const { text: actual, report } = review(save(baseline, payload));
    expect(formatCompletenessReport(report)).toBe('');
    expect(actual).not.toContain('undefined');
  });

  // The serializer omits auto grid settings left at their defaults, so a new dashboard must not report them.
  it('does not report auto grid settings the new dashboard never set', () => {
    const payload = dashboard({
      elements: elements(['panel-1', panel('A', { id: 1 })]),
      layout: autoGrid([autoGridItem('panel-1')]),
    });

    const { text: actual, report } = review({ mode: 'new', baselineKind: 'saved', baseline: null, payload });

    expect(formatCompletenessReport(report)).toBe('');
    expect(actual).not.toContain('Fill screen');
    expect(actual).not.toContain('Fit content');
    expect(actual).not.toContain('Match row heights');
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
      if (d.layout.kind !== 'RowsLayout') {
        throw new Error('qa: expected a rows layout');
      }
      const rowsSpec = d.layout.spec.rows;
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

    it('stays complete, collapses panels and finishes quickly', () => {
      const started = performance.now();
      const summary = summarizeDashboardChanges(save(baseline, payload));
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
      expect(summary.overview.line).toBe('Changes to 13 rows');
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
