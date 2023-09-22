import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip } from '@grafana/ui';

import { Message, generateTextWithLLM, isLLMPluginEnabled } from './utils';

export interface GenAIButtonProps {
  // Button label text
  text?: string;
  // Button label text when loading
  loadingText?: string;
  // Button click handler
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Messages to send to the LLM plugin
  messages: Message[];
  // Callback when the LLM plugin responds. It is sreaming, so it will be called multiple times.
  onGenerate: (response: string, isDone: boolean) => void;
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
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const replyHandler = (response: string, isDone: boolean) => {
    setLoading(!isDone);
    onGenerate(response, isDone);
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClickProp?.(e);
    setLoading(true);
    generateTextWithLLM(messages, replyHandler, temperature);
  };

  useEffect(() => {
    isLLMPluginEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  const getIcon = () => {
    if (loading) {
      return undefined;
    }
    if (!enabled) {
      return 'exclamation-circle';
    }
    return 'ai';
  };

  return (
    <div className={styles.wrapper}>
      {loading && <Spinner size={14} />}
      <Tooltip
        show={enabled ? false : undefined}
        interactive
        content={
          <span>
            The LLM plugin is not correctly configured. See your <Link href={`/plugins/grafana-llm-app`}>settings</Link>{' '}
            and enable your plugin.
          </span>
        }
      >
        <Button icon={getIcon()} onClick={onClick} fill="text" size="sm" disabled={loading || !enabled}>
          {!loading ? text : loadingText}
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
