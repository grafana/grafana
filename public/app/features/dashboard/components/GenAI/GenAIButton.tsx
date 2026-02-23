import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { llm } from '@grafana/llm';
import { Button, Spinner, useStyles2, Tooltip, Toggletip, Text, Stack } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { StreamStatus, TIMEOUT, useLLMStream } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { DEFAULT_LLM_MODEL, Message, sanitizeReply } from './utils';

export interface GenAIButtonProps {
  // Button label text
  text?: string;
  toggleTipTitle?: string;
  // Button click handler
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Messages to send to the LLM plugin
  messages: Message[] | (() => Message[]);
  // Callback function that the LLM plugin streams responses to
  onGenerate: (response: string) => void;
  // Temperature for the LLM plugin. Default is 1.
  // Closer to 0 means more conservative, closer to 1 means more creative.
  temperature?: number;
  model?: llm.Model;
  // Event tracking source. Send as `src` to Rudderstack event
  eventTrackingSrc: EventTrackingSrc;
  // Whether the button should be disabled
  disabled?: boolean;
  /*
    Tooltip to show when hovering over the button
    Tooltip will be shown only before the improvement stage.
    i.e once the button title changes to "Improve", the tooltip will not be shown because
    toggletip will be enabled.
  */
  tooltip?: string;
  // Optional callback to receive history updates
  onHistoryChange?: (history: string[]) => void;
  // Optional timeout for the LLM stream. Default is 10 seconds
  timeout?: number;
}
export const STOP_GENERATION_TEXT = 'Stop generating';

export const GenAIButton = ({
  text = 'Auto-generate',
  toggleTipTitle = '',
  onClick: onClickProp,
  model = DEFAULT_LLM_MODEL,
  messages,
  onGenerate,
  temperature = 1,
  eventTrackingSrc,
  disabled,
  tooltip,
  onHistoryChange,
  timeout = TIMEOUT,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  const [history, setHistory] = useState<string[]>([]);
  const unshiftHistoryEntry = useCallback(
    (historyEntry: string) => {
      setHistory((h) => {
        const newHistory = [historyEntry, ...h];
        return newHistory;
      });
      onHistoryChange?.([historyEntry, ...history]);
    },
    [onHistoryChange, history]
  );

  const onResponse = useCallback(
    (reply: string) => {
      const sanitizedReply = sanitizeReply(reply);
      onGenerate(sanitizedReply);
      unshiftHistoryEntry(sanitizedReply);
    },
    [onGenerate, unshiftHistoryEntry]
  );

  const { setMessages, stopGeneration, value, error, streamStatus } = useLLMStream({
    model,
    temperature,
    onResponse,
    timeout,
  });

  const [showHistory, setShowHistory] = useState(false);
  const hasHistory = history.length > 0;
  const isFirstHistoryEntry = !hasHistory;

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const isButtonDisabled = disabled || (value && !value.enabled && !error);
  const reportInteraction = useCallback(
    (item: AutoGenerateItem) => reportAutoGenerateInteraction(eventTrackingSrc, item),
    [eventTrackingSrc]
  );

  const showTooltip = error || tooltip ? undefined : false;
  const tooltipContent = error
    ? 'Failed to generate content using LLM. Please try again or if the problem persists, contact your organization admin.'
    : tooltip || '';

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (streamStatus === StreamStatus.GENERATING) {
      stopGeneration();
    } else {
      if (!hasHistory) {
        onClickProp?.(e);
        setMessages(getMessages());
      } else {
        setShowHistory(true);
      }
    }

    const buttonItem = error
      ? AutoGenerateItem.erroredRetryButton
      : isGenerating
        ? AutoGenerateItem.stopGenerationButton
        : isFirstHistoryEntry
          ? AutoGenerateItem.autoGenerateButton
          : AutoGenerateItem.improveButton;
    reportInteraction(buttonItem);
  };

  // The button is disabled if the plugin is not installed or enabled
  if (!value?.enabled) {
    return null;
  }

  const onApplySuggestion = (suggestion: string) => {
    reportInteraction(AutoGenerateItem.applySuggestion);
    onGenerate(suggestion);
    setShowHistory(false);
  };

  const getIcon = () => {
    if (isGenerating) {
      return undefined;
    }

    if (error || (value && !value.enabled)) {
      return 'exclamation-circle';
    }

    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (error) {
      buttonText = 'Retry';
    }

    if (isGenerating) {
      buttonText = STOP_GENERATION_TEXT;
    }

    if (hasHistory) {
      buttonText = 'Improve';
    }

    return buttonText;
  };

  const button = (
    <Button
      icon={getIcon()}
      onClick={onClick}
      fill="text"
      size="sm"
      disabled={isButtonDisabled}
      variant={error ? 'destructive' : 'primary'}
    >
      {getText()}
    </Button>
  );

  const getMessages = () => (typeof messages === 'function' ? messages() : messages);

  const renderButtonWithToggletip = () => {
    if (hasHistory) {
      const title = <Text element="p">{toggleTipTitle}</Text>;

      return (
        <Toggletip
          title={title}
          content={
            <GenAIHistory
              history={history}
              messages={getMessages()}
              onApplySuggestion={onApplySuggestion}
              updateHistory={unshiftHistoryEntry}
              eventTrackingSrc={eventTrackingSrc}
              timeout={timeout}
            />
          }
          placement="left-start"
          fitContent={true}
          show={showHistory}
          onClose={() => setShowHistory(false)}
          onOpen={() => setShowHistory(true)}
        >
          {button}
        </Toggletip>
      );
    }

    return button;
  };

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      {isGenerating && <Spinner size="sm" className={styles.spinner} />}
      {isFirstHistoryEntry ? (
        <Tooltip show={showTooltip} interactive content={tooltipContent}>
          {button}
        </Tooltip>
      ) : (
        renderButtonWithToggletip()
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spinner: css({
    color: theme.colors.text.link,
  }),
});
