import { useAssistant } from '@grafana/assistant';
import { type DataFrame, type InterpolateFunction } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { type AssistantTooltipContext, buildDatapointAssistantContext } from './buildAssistantContext';

interface AssistantTooltipButtonProps {
  /** uPlot-aligned frame (field 0 is the x/time field). */
  series: DataFrame;
  /** Index of the hovered series field within `series.fields`. */
  seriesIdx: number;
  /** Per-field hovered row indices (field 0 holds the x index). */
  dataIdxs: Array<number | null>;
  replaceVariables: InterpolateFunction;
  /** Panel-level context assembled by TimeSeriesPanel. */
  context: AssistantTooltipContext;
}

/**
 * "Ask Assistant" button for a hovered data point. Hidden when the assistant plugin isn't installed.
 * Opens the assistant with the point, series and panel as context pills, without auto-sending.
 */
export function AssistantTooltipButton({
  series,
  seriesIdx,
  dataIdxs,
  replaceVariables,
  context,
}: AssistantTooltipButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();

  if (!isAvailable) {
    return null;
  }

  const handleClick = () => {
    const items = buildDatapointAssistantContext({
      alignedFrame: series,
      seriesIdx,
      dataIdxs,
      replaceVariables,
      ...context,
    });

    if (items.length === 0) {
      return;
    }

    openAssistant?.({
      origin: 'grafana/panel-tooltip',
      context: items,
      autoSend: false,
    });
  };

  return (
    <Button icon="ai-sparkle" variant="secondary" size="sm" onClick={handleClick}>
      {t('timeseries.assistant-tooltip-button.ask-assistant', 'Ask Assistant')}
    </Button>
  );
}
