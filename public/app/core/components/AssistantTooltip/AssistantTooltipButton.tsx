import { css } from '@emotion/css';

import { ASSISTANT_PLUGIN_ID, useAssistant } from '@grafana/assistant';
import { type DataFrame, type GrafanaTheme2, type InterpolateFunction, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import {
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';

import { type AssistantTooltipContext, buildDatapointAssistantContext } from './buildAssistantContext';

// Active conversation id stored by the assistant app.
const ACTIVE_ASSISTANT_CHAT_ID_KEY = 'grafana-assistant-active-chat-id';

function getActiveAssistantChatId(): string | undefined {
  return store.get(ACTIVE_ASSISTANT_CHAT_ID_KEY) ?? undefined;
}

interface AssistantTooltipButtonProps {
  /** uPlot-aligned frame (field 0 is x). */
  series: DataFrame;
  /** Index of the hovered series field within `series.fields`. */
  seriesIdx: number;
  /** Per-field hovered row indices (field 0 holds the x index). */
  dataIdxs: Array<number | null>;
  replaceVariables: InterpolateFunction;
  /** Panel-level context assembled by the viz panel. */
  context: AssistantTooltipContext;
}

/** "Add to Assistant" button that sends a hovered data point to the assistant as a context pill. */
export function AssistantTooltipButton({
  series,
  seriesIdx,
  dataIdxs,
  replaceVariables,
  context,
}: AssistantTooltipButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();
  const { isOpen, dockedComponentId } = useExtensionSidebarContext();
  const styles = useStyles2(getStyles);

  if (!isAvailable) {
    return null;
  }

  // Continue the open chat only if the assistant sidebar is open
  const isAssistantSidebarOpen =
    isOpen && getComponentMetaFromComponentId(dockedComponentId ?? '')?.pluginId === ASSISTANT_PLUGIN_ID;

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
      appendContext: true,
      chatId: isAssistantSidebarOpen ? getActiveAssistantChatId() : undefined,
    });
  };

  return (
    <div className={styles.footerSection}>
      <Button icon="ai-sparkle" variant="secondary" size="sm" onClick={handleClick}>
        {t('assistant-tooltip.add-to-assistant', 'Add to Assistant')}
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footerSection: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
});
