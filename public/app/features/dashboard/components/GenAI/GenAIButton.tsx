import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { llms } from '@grafana/experimental';
import { Button, Spinner, useStyles2, Link, Tooltip } from '@grafana/ui';

import { useOpenaiStreamHook } from './hooks';
import { OPEN_AI_MODEL } from './utils';

export interface GenAIButtonProps {
  text?: string;
  loadingText?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  messages: llms.openai.Message[];
  onReply: (response: string) => void;
  temperature?: number;
}

export const GenAIButton = ({
  text = 'Auto-generate',
  loadingText = 'Generating',
  onClick,
  messages,
  onReply,
  temperature = 1,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  // TODO: Implement error handling (use error object from hook)
  const { setMessages, reply, started, loading, value } = useOpenaiStreamHook(OPEN_AI_MODEL, temperature);

  const onGenerate = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    setMessages(messages);
  };

  if (started) {
    onReply(reply);
  }

  const isGenerating = loading || started;

  const getIcon = () => {
    if (isGenerating) {
      return undefined;
    }
    if (!value?.enabled) {
      return 'exclamation-circle';
    }
    return 'ai';
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
        <Button icon={getIcon()} onClick={onGenerate} fill="text" size="sm" disabled={isGenerating || !value?.enabled}>
          {!isGenerating ? text : loadingText}
        </Button>
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
});
