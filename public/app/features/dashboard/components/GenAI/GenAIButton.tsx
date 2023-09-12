import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip } from '@grafana/ui';

import { Message, generateTextWithLLM, isLLMPluginEnabled } from './utils';

interface GenAIButtonProps {
  text?: string;
  loadingText?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  messages: Message[];
  onReply: (response: string, isDone: boolean) => void;
}

export const GenAIButton = ({
  text = 'Auto-generate',
  loadingText = 'Generating',
  onClick,
  messages,
  onReply,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const replyHandler = (response: string, isDone: boolean) => {
    setLoading(!isDone);
    onReply(response, isDone);
  };

  const onGenerate = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    setLoading(true);
    generateTextWithLLM(messages, replyHandler);
  };

  isLLMPluginEnabled()
    .then(setEnabled)
    .catch(() => setEnabled(false));

  // If the plugin is not enabled/configured, the button is disabled
  if (!enabled) {
    return (
      <div className={styles.wrapper}>
        <Tooltip
          interactive
          content={
            <span>
              The LLM plugin is not correctly configured. See your{' '}
              <Link href={`/plugins/grafana-llm-app`}>settings</Link> and enable your plugin.
            </span>
          }
        >
          <Button icon={'exclamation-circle'} fill="text" size="sm" disabled>
            {text}
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {loading && <Spinner size={14} />}
      <Button icon={!loading ? 'ai' : undefined} onClick={onGenerate} fill="text" size="sm" disabled={loading}>
        {!loading ? text : loadingText}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
  `,
});
