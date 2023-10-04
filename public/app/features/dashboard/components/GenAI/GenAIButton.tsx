import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Tooltip, Toggletip, Text } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { StreamStatus, useOpenAIStream } from './hooks';
import { OPEN_AI_MODEL, Message } from './utils';

export interface GenAIButtonProps {
  // Button label text
  text?: string;
  // Button label text when loading
  loadingText?: string;
  toggleTipTitle?: string;
  // Button click handler
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Messages to send to the LLM plugin
  messages: Message[];
  // Callback function that the LLM plugin streams responses to
  onGenerate: (response: string) => void;
  // Temperature for the LLM plugin. Default is 1.
  // Closer to 0 means more conservative, closer to 1 means more creative.
  temperature?: number;
}

export const GenAIButton = ({
  text = 'Auto-generate',
  loadingText = 'Generating',
  toggleTipTitle = '',
  onClick: onClickProp,
  messages,
  onGenerate,
  temperature = 1,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  const { setMessages, reply, value, error, streamStatus } = useOpenAIStream(OPEN_AI_MODEL, temperature);

  const [history, setHistory] = useState<string[]>([]);
  const [shouldCloseHistory, setShouldCloseHistory] = useState(false);

  const hasHistory = history.length > 0;
  const isFirstGeneration = streamStatus === StreamStatus.GENERATING && !hasHistory;
  const isButtonDisabled = isFirstGeneration || (value && !value.enabled && !error);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasHistory) {
      onClickProp?.(e);
      setMessages(messages);
    }
  };

  const updateHistory = useCallback(
    (historyEntry: string) => {
      if (history.indexOf(historyEntry) === -1) {
        setHistory([historyEntry, ...history]);
      }
    },
    [history]
  );

  useEffect(() => {
    // Todo: Consider other options for `"` sanitation
    if (isFirstGeneration && reply) {
      onGenerate(reply.replace(/^"|"$/g, ''));
    }
  }, [streamStatus, reply, onGenerate, isFirstGeneration]);

  useEffect(() => {
    if (streamStatus === StreamStatus.COMPLETED) {
      updateHistory(reply.replace(/^"|"$/g, ''));
    }
  }, [history, streamStatus, reply, updateHistory]);

  // The button is disabled if the plugin is not installed or enabled
  if (!value?.enabled) {
    return null;
  }

  const onApplySuggestion = (suggestion: string) => {
    onGenerate(suggestion);
    setShouldCloseHistory(true);

    setTimeout(() => {
      setShouldCloseHistory(false);
    });
  };

  const getIcon = () => {
    if (isFirstGeneration) {
      return undefined;
    }
    if (error || (value && !value?.enabled)) {
      return 'exclamation-circle';
    }
    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (error) {
      buttonText = 'Retry';
    }

    if (isFirstGeneration) {
      buttonText = loadingText;
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

  const renderButtonWithToggletip = () => {
    if (hasHistory) {
      const title = <Text element="p">{toggleTipTitle}</Text>;

      return (
        <Toggletip
          title={title}
          content={
            <GenAIHistory
              history={history}
              messages={messages}
              onApplySuggestion={onApplySuggestion}
              updateHistory={updateHistory}
            />
          }
          placement="bottom-start"
          shouldClose={shouldCloseHistory}
        >
          {button}
        </Toggletip>
      );
    }

    return button;
  };

  return (
    <div className={styles.wrapper}>
      {isFirstGeneration && <Spinner size={14} />}
      {!hasHistory && (
        <Tooltip show={error ? undefined : false} interactive content={`OpenAI error: ${error?.message}`}>
          {button}
        </Tooltip>
      )}
      {hasHistory && renderButtonWithToggletip()}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
  }),
});
