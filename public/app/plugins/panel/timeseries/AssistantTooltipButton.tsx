import { useMemo } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type DataFrame, type InterpolateFunction, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import {
  type AssistantTooltipContext,
  buildDatapointAssistantContext,
  buildDatapointContextData,
} from './buildAssistantContext';
import { emitDatapointContextToParent, getDatapointEmbedTarget } from './emitDatapointContext';

// Active conversation id the assistant app stores (same origin); passed so the open chat continues.
const ACTIVE_ASSISTANT_CHAT_ID_KEY = 'grafana-assistant-active-chat-id';

function getActiveAssistantChatId(): string | undefined {
  return store.get(ACTIVE_ASSISTANT_CHAT_ID_KEY) ?? undefined;
}

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
 * "Ask Assistant" button for a hovered data point. Sends the point/series/panel context to the in-app
 * assistant, or to the embedding window. Hidden if neither exists.
 */
export function AssistantTooltipButton({
  series,
  seriesIdx,
  dataIdxs,
  replaceVariables,
  context,
}: AssistantTooltipButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();
  const embedTarget = useMemo(() => getDatapointEmbedTarget(), []);

  const canOpenAssistant = isAvailable && openAssistant != null;
  if (!canOpenAssistant && embedTarget == null) {
    return null;
  }

  const args = { alignedFrame: series, seriesIdx, dataIdxs, replaceVariables, ...context };

  const handleClick = () => {
    // An explicit embed opt-in (host set the target param) wins over the in-app assistant.
    if (embedTarget != null) {
      const items = buildDatapointContextData(args);
      if (items.length > 0) {
        emitDatapointContextToParent(items, embedTarget);
      }
    } else if (canOpenAssistant) {
      const items = buildDatapointAssistantContext(args);
      if (items.length > 0) {
        openAssistant?.({
          origin: 'grafana/panel-tooltip',
          context: items,
          autoSend: false,
          chatId: getActiveAssistantChatId(),
        });
      }
    }
  };

  return (
    <Button icon="ai-sparkle" variant="secondary" size="sm" onClick={handleClick}>
      {t('timeseries.assistant-tooltip-button.ask-assistant', 'Ask Assistant')}
    </Button>
  );
}
