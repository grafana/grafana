import { type GrafanaTheme2, type IconName } from '@grafana/data';

import { QueryFlowNodeKind } from './types';

/**
 * Per-kind visuals. `color` is a named visualization color resolved via
 * `theme.visualization.getColorByName`; an empty string falls back to secondary text.
 * Shared by the node card and the editor-highlight so both use the same accent.
 */
export const KIND_META: Record<QueryFlowNodeKind, { icon: IconName; color: string }> = {
  [QueryFlowNodeKind.Selector]: { icon: 'database', color: 'blue' },
  [QueryFlowNodeKind.Range]: { icon: 'clock-nine', color: 'purple' },
  [QueryFlowNodeKind.Aggregation]: { icon: 'calculator-alt', color: 'orange' },
  [QueryFlowNodeKind.Function]: { icon: 'brackets-curly', color: 'green' },
  [QueryFlowNodeKind.Binary]: { icon: 'code-branch', color: 'red' },
  [QueryFlowNodeKind.Modifier]: { icon: 'step-backward', color: 'purple' },
  [QueryFlowNodeKind.LineFilter]: { icon: 'filter', color: 'teal' },
  [QueryFlowNodeKind.Parser]: { icon: 'brackets-curly', color: 'yellow' },
  [QueryFlowNodeKind.LabelFilter]: { icon: 'filter', color: 'teal' },
  [QueryFlowNodeKind.LabelFormat]: { icon: 'pen', color: 'yellow' },
  [QueryFlowNodeKind.Literal]: { icon: 'calculator-alt', color: 'blue' },
  [QueryFlowNodeKind.Unknown]: { icon: 'question-circle', color: '' },
};

/** Resolve the accent color for a node kind, matching the node card's left border. */
export function getNodeAccentColor(theme: GrafanaTheme2, kind: QueryFlowNodeKind): string {
  const meta = KIND_META[kind] ?? KIND_META[QueryFlowNodeKind.Unknown];
  return meta.color ? theme.visualization.getColorByName(meta.color) : theme.colors.text.secondary;
}
