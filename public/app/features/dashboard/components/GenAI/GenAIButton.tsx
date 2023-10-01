import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip, Toggletip, Text } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { getFeedbackMessage } from './GenAIPanelTitleButton';
import { useOpenAIStream } from './hooks';
import { Message, OPEN_AI_MODEL, QuickFeedback } from './utils';

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

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (history.length === 0) {
      onClickProp?.(e);
      setMessages(messages);
    }
  };

  const onGenerateWithFeedback = (suggestion: QuickFeedback, index: number) => {
    if (suggestion !== QuickFeedback.regenerate) {
      messages = [...messages, ...getFeedbackMessage(history[index], suggestion)];
      temperature = 0.5;
    }

    setMessages(messages);
  };

  useEffect(() => {
    if (reply !== '') {
      setResponse(reply);
    }
  }, [reply]);

  useEffect(() => {
    if (response !== '' && !isGenerating) {
      setHistory([response.replace(/^"|"$/g, ''), ...history]);
      setResponse('');
    }
  }, [history, isGenerating, reply, response]);

  // Todo: Consider other options for `"` sanitation
  if (isGenerating && history.length === 0) {
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
    if (isGenerating) {
      return undefined;
    }
    if (!value?.enabled) {
      return 'exclamation-circle';
    }
    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (history.length > 0) {
      buttonText = 'Improve';
    }

    if (isGenerating) {
      buttonText = loadingText;
    }

    return buttonText;
  };

  const button = (
    <Button icon={getIcon()} onClick={onClick} fill="text" size="sm" disabled={isGenerating || !value?.enabled}>
      {getText()}
    </Button>
  );

  // @TODO Fix React warning for Tooltip ref
  const renderButton = () => {
    if (history.length > 0) {
      const title = <Text element="p">{toggleTipTitle}</Text>;

      return (
        <Toggletip
          title={title}
          content={
            <GenAIHistory
              history={history}
              onGenerateWithFeedback={onGenerateWithFeedback}
              onApplySuggestion={onApplySuggestion}
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
      {isGenerating && <Spinner size={14} />}
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
