import { getFieldDisplayName, LoadingState, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { getInsightSourceData, getInsightSourcePanels, type InsightSourcePanel } from './sources';
import { type InsightContext, type InsightQuestion, type InsightSnapshot } from './types';

export const MAX_INSIGHT_INPUT_CHARACTERS = 100_000;

export function getInsightContext(dashboard: DashboardSceneLike, question: string): InsightContext {
  const timeRange = sceneGraph.getTimeRange(dashboard).state.value;
  const variables: Record<string, string> = {};
  for (const variable of sceneGraph.getVariables(dashboard)?.state.variables ?? []) {
    const name = variable.state.name;
    variables[name] = sceneGraph.interpolate(dashboard, `\${${name}}`);
  }
  return {
    question,
    dashboardUid: dashboard.state.uid ?? '',
    from: timeRange.from.toISOString(),
    to: timeRange.to.toISOString(),
    variables,
  };
}

type InsightSourceWithData = Omit<InsightSourcePanel, 'panel'> & { data?: PanelData };

/** Never queries a datasource or silently drops a selected source; throws a user-facing message instead. */
export function buildInsightSnapshot(
  context: InsightContext,
  selectedKeys: string[],
  available: InsightSourceWithData[]
): InsightSnapshot {
  if (!context.question.trim()) {
    throw new Error(t('dashboard.insights.snapshot.empty-question', 'This question is empty. Edit it to add text.'));
  }
  if (!selectedKeys.length) {
    throw new Error(
      t('dashboard.insights.snapshot.no-sources', 'This question has no source panels. Edit it to select at least one.')
    );
  }

  const panels = [...new Set(selectedKeys)].map((key) => {
    const source = available.find((candidate) => candidate.key === key);
    if (!source) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-unavailable',
          'A source panel is no longer on this dashboard. Edit the question to update its source panels.'
        )
      );
    }
    const { data, title } = source;
    if (!data || data.state !== LoadingState.Done) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-not-ready',
          '“{{title}}” is not ready. Wait for its query to finish successfully, then try again.',
          { title }
        )
      );
    }
    if (data.error || data.errors?.length) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-error',
          '“{{title}}” has a query error. Resolve it before asking Assistant.',
          { title }
        )
      );
    }
    if (!data.series.some((frame) => frame.length > 0 && frame.fields.length > 0)) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-empty',
          '“{{title}}” has no data for this selection. Adjust the filters or time range.',
          { title }
        )
      );
    }
    // Panel time overrides are not supported: refuse to describe mismatched ranges as one dashboard interval.
    if (
      data.timeRange &&
      (data.timeRange.from.toISOString() !== context.from || data.timeRange.to.toISOString() !== context.to)
    ) {
      throw new Error(
        t(
          'dashboard.insights.snapshot.source-time-range',
          '“{{title}}” uses a different time range. Wait for it to refresh or select matching panels.',
          { title }
        )
      );
    }

    return {
      key,
      title,
      description: source.description,
      frames: data.series.map((frame) => ({
        name: frame.name,
        fields: frame.fields.map((field) => ({
          name: getFieldDisplayName(field, frame, data.series),
          type: field.type,
          unit: field.config.unit,
          labels: field.labels,
          values: Array.from(field.values),
        })),
      })),
    };
  });

  const serialized = JSON.stringify({ ...context, question: context.question.trim(), panels });
  if (serialized.length > MAX_INSIGHT_INPUT_CHARACTERS) {
    throw new Error(
      t(
        'dashboard.insights.snapshot.too-large',
        'The selected data is too large to send. Select fewer panels or a shorter time range.'
      )
    );
  }
  // Freeze nested labels and object-valued cells: live data may change while the request is in flight.
  const frozen: InsightSnapshot = JSON.parse(serialized);
  return frozen;
}

export function captureInsightSnapshot(
  dashboard: DashboardSceneLike,
  question: InsightQuestion
): { context: InsightContext; snapshot?: InsightSnapshot; unavailable?: string } {
  const context = getInsightContext(dashboard, question.question);
  const available = getInsightSourcePanels(dashboard)
    .filter((source) => question.sourcePanelKeys.includes(source.key))
    .map((source) => ({ ...source, data: getInsightSourceData(source.panel) }));
  try {
    return { context, snapshot: buildInsightSnapshot(context, question.sourcePanelKeys, available) };
  } catch (error) {
    return { context, unavailable: error instanceof Error ? error.message : String(error) };
  }
}
