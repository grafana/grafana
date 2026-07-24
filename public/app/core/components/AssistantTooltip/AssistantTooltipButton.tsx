import { css } from '@emotion/css';

import { ASSISTANT_PLUGIN_ID, useAssistant } from '@grafana/assistant';
import { type DataFrame, type GrafanaTheme2, type InterpolateFunction, store } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
  series: DataFrame;
  seriesIdx: number;
  dataIdxs: Array<number | null>;
  replaceVariables: InterpolateFunction;
  context: AssistantTooltipContext;
  xVal: number;
}

/** "Add to Assistant" button that sends a hovered data point to the assistant as a context pill. */
export function AssistantTooltipButton({
  series,
  seriesIdx,
  dataIdxs,
  replaceVariables,
  context,
  xVal,
}: AssistantTooltipButtonProps) {
  const { isAvailable, openAssistant } = useAssistant();
  const { isOpen, dockedComponentId } = useExtensionSidebarContext();
  const styles = useStyles2(getStyles);

  if (!isAvailable || !openAssistant) {
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
      xVal,
    });

    if (items.length === 0) {
      return;
    }

    openAssistant({
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
        <Trans i18nKey="assistant-tooltip.add-to-assistant">Add to Assistant</Trans>
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
