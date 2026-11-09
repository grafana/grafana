import { type InterpolateFunction, type TimeRange } from '@grafana/data';

export interface AssistantPanelContext {
  panelId: number;
  panelTitle: string;
  timeRange: TimeRange;
}

export function buildAssistantPanelContext({
  panelId,
  panelTitle,
  timeRange,
  replaceVariables,
}: AssistantPanelContext & { replaceVariables: InterpolateFunction }) {
  const resolveMacro = (macro: string) => {
    const resolved = replaceVariables(macro);
    return resolved && !resolved.includes('${') ? resolved : undefined;
  };

  return {
    panelId,
    panelTitle,
    dashboardUid: resolveMacro('${__dashboard.uid}'),
    dashboardTitle: resolveMacro('${__dashboard.title}'),
    timeRange: { from: timeRange.from.toISOString(), to: timeRange.to.toISOString() },
  };
}
