import { css } from '@emotion/css';

import { ASSISTANT_PLUGIN_ID, useAssistant } from '@grafana/assistant';
import { type DataFrame, type GrafanaTheme2, type InterpolateFunction, store, usePluginContext } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';

import { getAssistantChatIdToContinue } from './assistantSidebarState';
import { type AssistantTooltipContext, buildDatapointAssistantContext } from './buildAssistantContext';

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
  const { fullscreenWorkspaceActive } = useFullscreenWorkspace();
  const pluginContext = usePluginContext();
  const styles = useStyles2(getStyles);

  if (!isAvailable || !openAssistant) {
    return null;
  }

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

    reportInteraction('grafana_tooltip_add_to_assistant_clicked', {
      visualizationType: pluginContext?.meta?.id ?? 'unknown',
    });

    openAssistant({
      origin: 'grafana/panel-tooltip',
      context: items,
      autoSend: false,
      appendContext: true,
      chatId: getAssistantChatIdToContinue(),
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
