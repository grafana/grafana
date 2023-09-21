import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2, Link, Tooltip, Toggletip, Text } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { Message, generateTextWithLLM, isLLMPluginEnabled } from './utils';

export interface GenAIButtonProps {
  text?: string;
  loadingText?: string;
  toggleTipTitle?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  messages: Message[];
  onReply: (response: string, isDone: boolean) => void;
  temperature?: number;
}

export const GenAIButton = ({
  text = 'Auto-generate',
  loadingText = 'Generating',
  toggleTipTitle = '',
  onClick,
  messages,
  onReply,
  temperature = 1,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const replyHandler = (response: string, isDone: boolean) => {
    setLoading(!isDone);
    onReply(response, isDone);

    if (isDone) {
      setHistory([...history, response]);
    }
  };

  const onGenerate = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);

    if (!history.length) {
      setLoading(true);
      generateTextWithLLM(messages, replyHandler, temperature);
    }
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

  const getText = () => {
    let buttonText = text;

    if (history.length > 0) {
      buttonText = 'Improve';
    }

    if (loading) {
      buttonText = loadingText;
    }

    return buttonText;
  };

  const button = (
    <Button icon={getIcon()} onClick={onGenerate} fill="text" size="sm" disabled={loading || !enabled}>
      {getText()}
    </Button>
  );

  // @TODO Fix React warning for Tooltip ref
  const renderButton = () => {
    if (history.length > 0) {
      const title = <Text element="p">{toggleTipTitle}</Text>;

      return (
        <Toggletip title={title} content={<GenAIHistory history={history} />} placement="bottom-start">
          {button}
        </Toggletip>
      );
    }

    return button;
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
