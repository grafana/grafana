import { css } from '@emotion/css';
import { useState, useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Icon, Input, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { STOP_GENERATION_TEXT } from './GenAIButton';
import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedback } from './QuickFeedback';
import { StreamStatus, useLLMStream } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { getFeedbackMessage, Message, DEFAULT_LLM_MODEL, QuickFeedbackType, sanitizeReply } from './utils';

export interface GenAIHistoryProps {
  history: string[];
  messages: Message[];
  onApplySuggestion: (suggestion: string) => void;
  updateHistory: (historyEntry: string) => void;
  eventTrackingSrc: EventTrackingSrc;
  timeout?: number;
}

const temperature = 0.5;

export const GenAIHistory = ({
  eventTrackingSrc,
  history,
  messages,
  onApplySuggestion,
  updateHistory,
  timeout,
}: GenAIHistoryProps) => {
  const styles = useStyles2(getStyles);

  const [currentIndex, setCurrentIndex] = useState(1);
  const [customFeedback, setCustomPrompt] = useState('');

  // Keep ref in sync with messages prop to avoid stale closure issues
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const onResponse = useCallback(
    (response: string) => {
      updateHistory(sanitizeReply(response));
    },
    [updateHistory]
  );

  const { setMessages, stopGeneration, reply, streamStatus, error } = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature,
    onResponse,
    timeout,
  });

  const reportInteraction = (item: AutoGenerateItem, otherMetadata?: object) =>
    reportAutoGenerateInteraction(eventTrackingSrc, item, otherMetadata);

  const onSubmitCustomFeedback = (text: string) => {
    onGenerateWithFeedback(text);
    reportInteraction(AutoGenerateItem.customFeedback, { customFeedback: text });
  };

  const onStopGeneration = () => {
    stopGeneration();
    reply && onResponse(reply);
  };

  const onApply = () => {
    onApplySuggestion(history[currentIndex - 1]);
  };

  const onNavigate = (index: number) => {
    setCurrentIndex(index);
    reportInteraction(index > currentIndex ? AutoGenerateItem.backHistoryItem : AutoGenerateItem.forwardHistoryItem);
  };

  const onGenerateWithFeedback = (suggestion: string) => {
    setMessages(() => [...messagesRef.current, ...getFeedbackMessage(history[currentIndex - 1], suggestion)]);

    if (suggestion in QuickFeedbackType) {
      reportInteraction(AutoGenerateItem.quickFeedback, { quickFeedbackItem: suggestion });
    }
  };

  const onKeyDownCustomFeedbackInput = (e: React.KeyboardEvent<HTMLInputElement>) =>
    e.key === 'Enter' && onSubmitCustomFeedback(customFeedback);

  const onChangeCustomFeedback = (e: React.FormEvent<HTMLInputElement>) => setCustomPrompt(e.currentTarget.value);

  const onClickSubmitCustomFeedback = () => onSubmitCustomFeedback(customFeedback);

  const onClickDocs = () => reportInteraction(AutoGenerateItem.linkToDocs);

  const isStreamGenerating = streamStatus === StreamStatus.GENERATING;
  const showError = error && !isStreamGenerating;

  return (
    <div className={styles.container}>
      {showError && (
        <Alert title="">
          <Stack direction="column">
            <p>
              <Trans i18nKey="gen-ai.incomplete-request-error">
                Sorry, I was unable to complete your request. Please try again.
              </Trans>
            </p>
          </Stack>
        </Alert>
      )}

      <GenerationHistoryCarousel history={history} index={currentIndex} onNavigate={onNavigate} />
      <div className={styles.actionButtons}>
        <QuickFeedback onSuggestionClick={onGenerateWithFeedback} isGenerating={isStreamGenerating} />
      </div>

      <Input
        placeholder={t('dashboard.gen-aihistory.placeholder-tell-ai-what-to-do-next', 'Tell AI what to do next...')}
        suffix={
          <Button
            icon="enter"
            variant="secondary"
            fill="text"
            aria-label={t('dashboard.gen-aihistory.aria-label-send-custom-feedback', 'Send custom feedback')}
            onClick={onClickSubmitCustomFeedback}
            disabled={!customFeedback}
          >
            <Trans i18nKey="gen-ai.send-custom-feedback">Send</Trans>
          </Button>
        }
        value={customFeedback}
        onChange={onChangeCustomFeedback}
        onKeyDown={onKeyDownCustomFeedbackInput}
      />

      <div className={styles.applySuggestion}>
        <Stack justifyContent="flex-end" direction="row">
          {isStreamGenerating ? (
            <Button icon="fa fa-spinner" onClick={onStopGeneration}>
              {STOP_GENERATION_TEXT}
            </Button>
          ) : (
            <Button icon="check" onClick={onApply}>
              <Trans i18nKey="gen-ai.apply-suggestion">Apply</Trans>
            </Button>
          )}
        </Stack>
      </div>

      <div className={styles.footer}>
        <Icon name="exclamation-circle" className={styles.infoColor} />
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="dashboard.gen-aihistory.footer-text">
            This content is AI-generated using the{' '}
            <TextLink
              variant="bodySmall"
              inline={true}
              href="https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/"
              external
              onClick={onClickDocs}
            >
              Grafana LLM plugin
            </TextLink>
          </Trans>
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
    paddingBottom: 25,
  }),
  applySuggestion: css({
    paddingTop: theme.spacing(2),
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
  actionButtons: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '24px 0 8px 0',
  }),
});
