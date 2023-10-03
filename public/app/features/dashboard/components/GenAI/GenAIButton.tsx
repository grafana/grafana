import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip } from '@grafana/ui';

import { useOpenAIStream } from './hooks';
import { OPEN_AI_MODEL, Message } from './utils';

export interface GenAIButtonProps {
  // Button label text
  text?: string;
  // Button label text when loading
  loadingText?: string;
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
  onClick: onClickProp,
  messages,
  onGenerate,
  temperature = 1,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  // TODO: Implement error handling (use error object from hook)
  const { setMessages, reply, isGenerating, value, error } = useOpenAIStream(OPEN_AI_MODEL, temperature);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClickProp?.(e);
    setMessages(messages);
  };

  useEffect(() => {
    // Todo: Consider other options for `"` sanitation
    if (isGenerating && reply) {
      onGenerate(reply.replace(/^"|"$/g, ''));
    }
  }, [isGenerating, reply, onGenerate]);

  const getIcon = () => {
    if (error || !value?.enabled) {
      return 'exclamation-circle';
    }
    if (isGenerating) {
      return undefined;
    }
    return 'ai';
  };

  const getTooltipContent = () => {
    if (error) {
      return `Unexpected error: ${error.message}`;
    }
    if (!value?.enabled) {
      return (
        <span>
          The LLM plugin is not correctly configured. See your <Link href={`/plugins/grafana-llm-app`}>settings</Link>{' '}
          and enable your plugin.
        </span>
      );
    }
    return '';
  };

  const getText = () => {
    if (error) {
      return 'Retry';
    }

    return !isGenerating ? text : loadingText;
  };

  return (
    <div className={styles.wrapper}>
      {isGenerating && <Spinner size={14} />}
      <Tooltip show={value?.enabled && !error ? false : undefined} interactive content={getTooltipContent()}>
        <Button
          icon={getIcon()}
          onClick={onClick}
          fill="text"
          size="sm"
          disabled={isGenerating || (!value?.enabled && !error)}
          variant={error ? 'destructive' : 'primary'}
        >
          {getText()}
        </Button>
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
  }),
});
