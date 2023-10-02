import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip, Toggletip, Text } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { useOpenAIStream } from './hooks';
import { Message, OPEN_AI_MODEL } from './utils';

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

  const [history, setHistory] = useState<string[]>([]);
  const [response, setResponse] = useState<string>('');
  const [shouldCloseHistory, setShouldCloseHistory] = useState(false);

  // TODO: Implement error handling (use error object from hook)
  const { setMessages, reply, isGenerating, value } = useOpenAIStream(OPEN_AI_MODEL, temperature);

  const hasHistory = history.length > 0;
  const isFirstGeneration = isGenerating && !hasHistory;
  const isButtonDisabled = isFirstGeneration || (value && !value.enabled);

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

  // @TODO: Find a better solution for this (isDone)
  useEffect(() => {
    if (reply !== '') {
      setResponse(reply);
    }
  }, [reply]);

  useEffect(() => {
    if (response !== '' && !isGenerating) {
      updateHistory(response.replace(/^"|"$/g, ''));
      setResponse('');
    }
  }, [history, isGenerating, reply, response, updateHistory]);

  // Todo: Consider other options for `"` sanitation
  if (isGenerating && !hasHistory) {
    onGenerate(reply.replace(/^"|"$/g, ''));
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
    if (value && !value.enabled) {
      return 'exclamation-circle';
    }
    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (isFirstGeneration) {
      buttonText = loadingText;
    }

    if (hasHistory) {
      buttonText = 'Improve';
    }

    return buttonText;
  };

  const button = (
    <Button icon={getIcon()} onClick={onClick} fill="text" size="sm" disabled={isButtonDisabled}>
      {getText()}
    </Button>
  );

  // @TODO Fix React warning for Tooltip ref
  const renderButton = () => {
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
      <Tooltip
        show={value?.enabled ? false : undefined}
        interactive
        content={
          <span>
            The LLM plugin is not correctly configured. See your <Link href={`/plugins/grafana-llm-app`}>settings</Link>{' '}
            and enable your plugin.
          </span>
        }
      >
        {renderButton()}
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
});
