import { t } from '@grafana/i18n';
import { type SceneObject, VizPanel } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';

export interface EditorialFinding {
  id: string;
  /** Short label for the rule. */
  rule: string;
  message: string;
  /** The element to select when the finding is opened. */
  target?: SceneObject;
}

const LEDE_WORD_LIMIT = 30;
const KPI_WALL_SIZE = 5;
const UNIT_PANELS = new Set(['timeseries', 'stat', 'barchart', 'gauge', 'bargauge', 'trend']);

/**
 * Reading-first checks for a report dashboard, distilled from the rules Grafana Pages gives its
 * page author: open on a finding, write headings that say something, avoid walls of KPI tiles,
 * and keep units beside numbers. Each finding is a suggestion; none blocks saving.
 */
export function getEditorialFindings(dashboard: DashboardScene): EditorialFinding[] {
  const findings: EditorialFinding[] = [];
  const { lede, body, title } = dashboard.state;
  const rows = collectRows(body);
  const reportRows = rows.filter((row) => row.state.headerStyle === 'report');

  if (reportRows.length > 0 && !lede?.trim()) {
    findings.push({
      id: 'lede-missing',
      rule: t('dashboard.review.rule.lede', 'Open on the finding'),
      message: t(
        'dashboard.review.lede-missing',
        'Add a lede: one sentence with the main finding, so the dashboard opens on its answer.'
      ),
    });
  }

  const ledeWords = lede?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  if (ledeWords > LEDE_WORD_LIMIT) {
    findings.push({
      id: 'lede-long',
      rule: t('dashboard.review.rule.lede', 'Open on the finding'),
      message: t('dashboard.review.lede-long', '', {
        count: ledeWords,
        defaultValue_one:
          'The lede has {{count}} word. Keep it to one sentence of about 25 and move context beside the evidence.',
        defaultValue_other:
          'The lede has {{count}} words. Keep it to one sentence of about 25 and move context beside the evidence.',
      }),
    });
  }

  if (isShouting(title)) {
    findings.push({
      id: 'title-caps',
      rule: t('dashboard.review.rule.headlines', 'Write headlines, not labels'),
      message: t('dashboard.review.title-caps', 'The title is in capitals. Sentence case reads faster.'),
    });
  }

  for (const row of reportRows) {
    const rowTitle = row.state.title ?? '';
    if (!row.state.summary?.trim()) {
      findings.push({
        id: `summary-${row.state.key}`,
        rule: t('dashboard.review.rule.summary', 'Say what each section shows'),
        message: t('dashboard.review.summary-missing', '"{{title}}" has no summary.', {
          title: rowTitle,
          interpolation: { escapeValue: false },
        }),
        target: row,
      });
    }
    if (rowTitle.trim().split(/\s+/).length <= 2) {
      findings.push({
        id: `headline-${row.state.key}`,
        rule: t('dashboard.review.rule.headlines', 'Write headlines, not labels'),
        message: t(
          'dashboard.review.headline-label',
          '"{{title}}" names a topic. A heading that states the result tells readers why to look.',
          { title: rowTitle, interpolation: { escapeValue: false } }
        ),
        target: row,
      });
    }
  }

  for (const grid of collectGrids(body)) {
    const tiles = grid
      .getVizPanels()
      .filter((panel) => panel.state.pluginId === 'stat' && !isFigure(panel.state.options));
    if (tiles.length >= KPI_WALL_SIZE) {
      findings.push({
        id: `kpi-wall-${grid.state.key}`,
        rule: t('dashboard.review.rule.kpi-wall', 'Avoid a wall of KPI tiles'),
        message: t('dashboard.review.kpi-wall', '', {
          count: tiles.length,
          defaultValue_one:
            '{{count}} stat tile sits beside the others. Lead with the one that matters, or set them as figures in a rail beside the chart that explains them.',
          defaultValue_other:
            '{{count}} stat tiles sit side by side. Lead with the one that matters, or set them as figures in a rail beside the chart that explains them.',
        }),
        target: grid.parent ?? undefined,
      });
    }
  }

  for (const panel of body.getVizPanels()) {
    if (UNIT_PANELS.has(panel.state.pluginId) && !panel.state.fieldConfig?.defaults?.unit) {
      findings.push({
        id: `unit-${panel.state.key}`,
        rule: t('dashboard.review.rule.units', 'Show units beside numbers'),
        message: t('dashboard.review.unit-missing', '"{{title}}" has no unit.', {
          title: panel.state.title || t('dashboard.review.untitled', 'Untitled panel'),
          interpolation: { escapeValue: false },
        }),
        target: panel,
      });
    }
    if (isShouting(panel.state.title)) {
      findings.push({
        id: `caps-${panel.state.key}`,
        rule: t('dashboard.review.rule.headlines', 'Write headlines, not labels'),
        message: t('dashboard.review.panel-caps', '"{{title}}" is in capitals. Sentence case reads faster.', {
          title: panel.state.title,
          interpolation: { escapeValue: false },
        }),
        target: panel,
      });
    }
  }

  return findings;
}

function isFigure(options: object | undefined): boolean {
  return Boolean(options && 'presentation' in options && options.presentation === 'figure');
}

function isShouting(text: string | undefined): boolean {
  const letters = text?.replace(/[^A-Za-z]/g, '') ?? '';
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function collectRows(root: SceneObject): RowItem[] {
  const rows: RowItem[] = [];
  root.forEachChild?.((child) => {
    if (child instanceof RowItem) {
      rows.push(child);
    }
    if (!(child instanceof VizPanel)) {
      rows.push(...collectRows(child));
    }
  });
  return rows;
}

function collectGrids(root: SceneObject): AutoGridLayoutManager[] {
  const grids: AutoGridLayoutManager[] = root instanceof AutoGridLayoutManager ? [root] : [];
  root.forEachChild?.((child) => {
    if (!(child instanceof VizPanel)) {
      grids.push(...collectGrids(child));
    }
  });
  return grids;
}
