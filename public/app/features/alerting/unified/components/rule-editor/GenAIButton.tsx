import { css } from '@emotion/css';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { llm } from '@grafana/llm';
import { Button, Spinner, Text, Toggletip, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { StreamStatus, useLLMStream } from '../../../../dashboard/components/GenAI/hooks';
import { DEFAULT_LLM_MODEL, sanitizeReply } from '../../../../dashboard/components/GenAI/utils';

/**
 * Message roles for LLM interactions
 */
export enum Role {
  // System content cannot be overwritten by user prompts.
  'system' = 'system',
  // User content is the content that the user has entered.
  // This content can be overwritten by following prompt.
  'user' = 'user',
}

const GenAIHistory = ({
  history,
  onApplySuggestion,
}: {
  history: string[];
  onApplySuggestion: (suggestion: string) => void;
}) => {
  return (
    <div>
      {history.map((suggestion, i) => (
        <div key={i} style={{ marginBottom: '8px' }}>
          <Text>{suggestion}</Text>
          <Button size="sm" variant="secondary" onClick={() => onApplySuggestion(suggestion)}>
            <Trans>Apply</Trans>
          </Button>
        </div>
      ))}
    </div>
  );
};

export type Message = llm.Message;

export interface GenAIButtonProps {
  text?: string;
  toggleTipTitle?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  // Messages to send to the LLM plugin
  messages: Message[] | (() => Message[]);
  // Callback function that the LLM plugin streams responses to
  onGenerate: (response: string) => void;
  // Temperature for the LLM plugin. Default is 1.
  // Closer to 0 means more conservative, closer to 1 means more creative.
  temperature?: number;
  model?: llm.Model;
  disabled?: boolean;
  tooltip?: string;
}

export const STOP_GENERATION_TEXT = <Trans>Stop generating</Trans>;

export const GenAIButton = ({
  text = <Trans>Auto-generate</Trans>,
  toggleTipTitle = '',
  onClick: onClickProp,
  model = DEFAULT_LLM_MODEL,
  messages,
  onGenerate,
  temperature = 1,
  disabled,
  tooltip,
}: GenAIButtonProps) => {
  const styles = useStyles2(getStyles);

  const [history, setHistory] = useState<string[]>([]);
  const unshiftHistoryEntry = useCallback((historyEntry: string) => {
    setHistory((h) => [historyEntry, ...h]);
  }, []);

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
  });

  const [showHistory, setShowHistory] = useState(false);
  const hasHistory = history.length > 0;
  const isFirstHistoryEntry = !hasHistory;

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const isButtonDisabled = disabled || (value && !value.enabled && !error);

  const showTooltip = error || tooltip ? undefined : false;
  const tooltipContent = error ? (
    <Trans>
      Failed to generate content using LLM. Please try again or if the problem persists, contact your organization
      admin.
    </Trans>
  ) : (
    tooltip || ''
  );

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
  };

  // The button is disabled if the plugin is not installed or enabled
  if (!value?.enabled) {
    return null;
  }

  const onApplySuggestion = (suggestion: string) => {
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
      buttonText = <Trans>Retry</Trans>;
    }

    if (isGenerating) {
      buttonText = STOP_GENERATION_TEXT;
    }

    if (hasHistory) {
      buttonText = <Trans>Improve</Trans>;
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
          content={<GenAIHistory history={history} onApplySuggestion={onApplySuggestion} />}
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
    <div className={styles.wrapper}>
      {isGenerating && <Spinner size="sm" className={styles.spinner} />}
      {isFirstHistoryEntry ? (
        <Tooltip show={showTooltip} interactive content={tooltipContent}>
          {button}
        </Tooltip>
      ) : (
        renderButtonWithToggletip()
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
  }),
  spinner: css({
    color: theme.colors.text.link,
  }),
});
