import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip } from '@grafana/ui';

import { Message, generateTextWithLLM, isLLMPluginEnabled } from './utils';

export interface GenAIButtonProps {
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
  const [enabled, setEnabled] = useState(true);
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
        <Button icon={getIcon()} onClick={onGenerate} fill="text" size="sm" disabled={loading || !enabled}>
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
