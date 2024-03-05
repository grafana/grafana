import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Icon, IconButton, Input, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { STOP_GENERATION_TEXT } from './GenAIButton';
import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedback } from './QuickFeedback';
import { StreamStatus, useOpenAIStream } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { getFeedbackMessage, Message, DEFAULT_OAI_MODEL, QuickFeedbackType, sanitizeReply } from './utils';

export interface GenAIHistoryProps {
  history: string[];
  messages: Message[];
  onApplySuggestion: (suggestion: string) => void;
  updateHistory: (historyEntry: string) => void;
  eventTrackingSrc: EventTrackingSrc;
}

const temperature = 0.5;

export const GenAIHistory = ({
  eventTrackingSrc,
  history,
  messages,
  onApplySuggestion,
  updateHistory,
}: GenAIHistoryProps) => {
  const styles = useStyles2(getStyles);

  const [currentIndex, setCurrentIndex] = useState(1);
  const [showError, setShowError] = useState(false);
  const [customFeedback, setCustomPrompt] = useState('');

  const { setMessages, setStopGeneration, reply, streamStatus, error } = useOpenAIStream(
    DEFAULT_OAI_MODEL,
    temperature
  );

  const isStreamGenerating = streamStatus === StreamStatus.GENERATING;

  const reportInteraction = (item: AutoGenerateItem, otherMetadata?: object) =>
    reportAutoGenerateInteraction(eventTrackingSrc, item, otherMetadata);

  useEffect(() => {
    if (!isStreamGenerating && reply !== '') {
      setCurrentIndex(1);
    }
  }, [isStreamGenerating, reply]);

  useEffect(() => {
    if (streamStatus === StreamStatus.COMPLETED) {
      updateHistory(sanitizeReply(reply));
    }
  }, [streamStatus, reply, updateHistory]);

  useEffect(() => {
    if (error) {
      setShowError(true);
    }

    if (streamStatus === StreamStatus.GENERATING) {
      setShowError(false);
    }
  }, [error, streamStatus]);

  const onSubmitCustomFeedback = (text: string) => {
    onGenerateWithFeedback(text);
    reportInteraction(AutoGenerateItem.customFeedback, { customFeedback: text });
  };

  const onApply = () => {
    if (isStreamGenerating) {
      setStopGeneration(true);
      if (reply !== '') {
        updateHistory(sanitizeReply(reply));
      }
    } else {
      onApplySuggestion(history[currentIndex - 1]);
    }
  };

  const onNavigate = (index: number) => {
    setCurrentIndex(index);
    reportInteraction(index > currentIndex ? AutoGenerateItem.backHistoryItem : AutoGenerateItem.forwardHistoryItem);
  };

  const onGenerateWithFeedback = (suggestion: string | QuickFeedbackType) => {
    if (suggestion !== QuickFeedbackType.Regenerate) {
      messages = [...messages, ...getFeedbackMessage(history[currentIndex - 1], suggestion)];
    } else {
      messages = [...messages, ...getFeedbackMessage(history[currentIndex - 1], 'Please, regenerate')];
    }

    setMessages(messages);

    if (suggestion in QuickFeedbackType) {
      reportInteraction(AutoGenerateItem.quickFeedback, { quickFeedbackItem: suggestion });
    }
  };

  const onKeyDownCustomFeedbackInput = (e: React.KeyboardEvent<HTMLInputElement>) =>
    e.key === 'Enter' && onSubmitCustomFeedback(customFeedback);

  const onChangeCustomFeedback = (e: React.FormEvent<HTMLInputElement>) => setCustomPrompt(e.currentTarget.value);

  const onClickSubmitCustomFeedback = () => onSubmitCustomFeedback(customFeedback);

  const onClickDocs = () => reportInteraction(AutoGenerateItem.linkToDocs);

  return (
    <div className={styles.container}>
      {showError && (
        <Alert title="">
          <Stack direction={'column'}>
            <p>Sorry, I was unable to complete your request. Please try again.</p>
          </Stack>
        </Alert>
      )}

      <Input
        placeholder="Tell AI what to do next..."
        suffix={
          <IconButton
            name="corner-down-right-alt"
            variant="secondary"
            aria-label="Send custom feedback"
            onClick={onClickSubmitCustomFeedback}
            disabled={customFeedback === ''}
          />
        }
        value={customFeedback}
        onChange={onChangeCustomFeedback}
        onKeyDown={onKeyDownCustomFeedbackInput}
      />
      <div className={styles.actions}>
        <QuickFeedback onSuggestionClick={onGenerateWithFeedback} isGenerating={isStreamGenerating} />
        <GenerationHistoryCarousel
          history={history}
          index={currentIndex}
          onNavigate={onNavigate}
          reply={sanitizeReply(reply)}
          streamStatus={streamStatus}
        />
      </div>
      <div className={styles.applySuggestion}>
        <Stack justifyContent={'flex-end'} direction={'row'}>
          <Button icon={!isStreamGenerating ? 'check' : 'fa fa-spinner'} onClick={onApply}>
            {isStreamGenerating ? STOP_GENERATION_TEXT : 'Apply'}
          </Button>
        </Stack>
      </div>
      <div className={styles.footer}>
        <Icon name="exclamation-circle" aria-label="exclamation-circle" className={styles.infoColor} />
        <Text variant="bodySmall" color="secondary">
          This content is AI-generated using the{' '}
          <TextLink
            variant="bodySmall"
            href="https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/"
            external
            onClick={onClickDocs}
          >
            Grafana LLM plugin
          </TextLink>
        </Text>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    width: 520,
    maxHeight: 350,
    // This is the space the footer height
    paddingBottom: 35,
  }),
  applySuggestion: css({
    marginTop: theme.spacing(1),
  }),
  actions: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
  }),
  footer: css({
    // Absolute positioned since Toggletip doesn't support footer
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    margin: 0,
    padding: theme.spacing(1),
    paddingLeft: theme.spacing(2),
    alignItems: 'center',
    gap: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(2),
  }),
  infoColor: css({
    color: theme.colors.info.main,
  }),
});
