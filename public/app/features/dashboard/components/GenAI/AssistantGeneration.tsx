import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, Stack, Text, Toggletip, Tooltip, useStyles2 } from '@grafana/ui';

import { GenAIHistory } from './GenAIHistory';
import { StreamStatus } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { Message, Role, sanitizeReply } from './utils';

const ASSISTANT_ORIGIN = 'grafana/panel-metadata';

export interface AssistantPromptResult {
  systemPrompt: string;
  prompt: string;
}

export interface AssistantGenerationButtonProps {
  // Button label text
  text?: string;
  toggleTipTitle?: string;
  /** Assistant-specific: function that returns systemPrompt and prompt directly */
  getPrompt?: () => AssistantPromptResult;
  /** Alternative: messages in LLM format (converted to prompt internally) */
  messages?: Message[] | (() => Message[]);
  // Callback function when generation completes
  onGenerate: (response: string) => void;
  // Event tracking source
  eventTrackingSrc: EventTrackingSrc;
  // Whether the button should be disabled
  disabled?: boolean;
  // Tooltip to show when hovering over the button
  tooltip?: string;
  // Optional callback to receive history updates
  onHistoryChange?: (history: string[]) => void;
}

export const STOP_GENERATION_TEXT = 'Stop generating';

const ASSISTANT_OUTPUT_INSTRUCTION =
  "Only return what you're asked for, no reasoning, no explanation whatsoever just the bits that are explicitly requested.";

export const AssistantGenerationButton = ({
  text = 'generate with Assistant',
  toggleTipTitle = '',
  getPrompt,
  messages,
  onGenerate,
  eventTrackingSrc,
  disabled,
  tooltip,
  onHistoryChange,
}: AssistantGenerationButtonProps) => {
  const styles = useStyles2(getStyles);
  const { generate } = useInlineAssistant();

  const [history, setHistory] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>(StreamStatus.IDLE);
  const [error, setError] = useState<Error | undefined>();
  const [showHistory, setShowHistory] = useState(false);

  const hasHistory = history.length > 0;
  const isFirstHistoryEntry = !hasHistory;
  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const isButtonDisabled = disabled;

  const unshiftHistoryEntry = useCallback(
    (historyEntry: string) => {
      setHistory((h) => {
        const newHistory = [historyEntry, ...h];
        return newHistory;
      });
      onHistoryChange?.([historyEntry, ...history]);
    },
    [onHistoryChange, history]
  );

  const reportInteraction = useCallback(
    (item: AutoGenerateItem) => reportAutoGenerateInteraction(eventTrackingSrc, item),
    [eventTrackingSrc]
  );

  const getMessagesForHistory = (): Message[] => {
    if (getPrompt) {
      const { systemPrompt, prompt } = getPrompt();
      return [
        { content: systemPrompt, role: Role.system },
        { content: prompt, role: Role.user },
      ];
    }
    const msgs = typeof messages === 'function' ? messages() : messages ?? [];
    return msgs;
  };

  const buildPromptFromMessages = (msgs: Message[]): { systemPrompt: string; prompt: string } => {
    const systemMessages = msgs.filter((m) => m.role === Role.system).map((m) => m.content);
    const userMessages = msgs.filter((m) => m.role === Role.user).map((m) => m.content);

    const systemPrompt = [systemMessages.join('\n'), ASSISTANT_OUTPUT_INSTRUCTION].join('\n\n');

    return {
      systemPrompt,
      prompt: userMessages.join('\n'),
    };
  };

  const handleGenerate = useCallback(async () => {
    setStreamStatus(StreamStatus.GENERATING);
    setError(undefined);

    const { systemPrompt, prompt } = getPrompt
      ? getPrompt()
      : buildPromptFromMessages(typeof messages === 'function' ? messages() : messages ?? []);

    try {
      await generate({
        origin: ASSISTANT_ORIGIN,
        systemPrompt,
        prompt,
        onComplete: (text) => {
          const sanitizedReply = sanitizeReply(text);
          onGenerate(sanitizedReply);
          unshiftHistoryEntry(sanitizedReply);
          setStreamStatus(StreamStatus.COMPLETED);
        },
        onError: (err) => {
          console.error('Assistant generation error:', err);
          setError(new Error(String(err)));
          setStreamStatus(StreamStatus.IDLE);
        },
      });
    } catch (e) {
      console.error('Assistant generation failed:', e);
      setError(e instanceof Error ? e : new Error(String(e)));
      setStreamStatus(StreamStatus.IDLE);
    }
  }, [generate, onGenerate, unshiftHistoryEntry, getPrompt, messages]);

  const onClick = () => {
    if (streamStatus === StreamStatus.GENERATING) {
      // Cannot stop Assistant generation currently
      return;
    }

    if (!hasHistory) {
      handleGenerate();
    } else {
      setShowHistory(true);
    }

    const buttonItem = error
      ? AutoGenerateItem.erroredRetryButton
      : isGenerating
        ? AutoGenerateItem.stopGenerationButton
        : isFirstHistoryEntry
          ? AutoGenerateItem.autoGenerateButton
          : AutoGenerateItem.improveButton;
    reportInteraction(buttonItem);
  };

  const onApplySuggestion = (suggestion: string) => {
    reportInteraction(AutoGenerateItem.applySuggestion);
    onGenerate(suggestion);
    setShowHistory(false);
  };

  const getIcon = () => {
    if (isGenerating) {
      return undefined;
    }

    if (error) {
      return 'exclamation-circle';
    }

    return 'ai';
  };

  const getText = () => {
    let buttonText = text;

    if (error) {
      buttonText = 'Retry';
    }

    if (isGenerating) {
      buttonText = STOP_GENERATION_TEXT;
    }

    if (hasHistory) {
      buttonText = 'Improve';
    }

    return buttonText;
  };

  const showTooltip = error || tooltip ? undefined : false;
  const tooltipContent = error
    ? 'Failed to generate content using Assistant. Please try again or if the problem persists, contact your organization admin.'
    : tooltip || '';

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
              messages={getMessagesForHistory()}
              onApplySuggestion={onApplySuggestion}
              updateHistory={unshiftHistoryEntry}
              eventTrackingSrc={eventTrackingSrc}
            />
          }
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
    <Stack direction="row" gap={0.5} alignItems="center">
      {isGenerating && <Spinner size="sm" className={styles.spinner} />}
      {isFirstHistoryEntry ? (
        <Tooltip show={showTooltip} interactive content={tooltipContent}>
          {button}
        </Tooltip>
      ) : (
        renderButtonWithToggletip()
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  spinner: css({
    color: theme.colors.text.link,
  }),
});
