import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  Divider,
  HorizontalGroup,
  Icon,
  Input,
  Link,
  Spinner,
  Text,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';

import { getFeedbackMessage } from './GenAIPanelTitleButton';
import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedback } from './QuickFeedback';
import { StreamStatus, useOpenAIStream } from './hooks';
import { AutoGenerateItem, EventTrackingSrc, reportAutoGenerateInteraction } from './tracking';
import { Message, OPEN_AI_MODEL, QuickFeedbackType } from './utils';

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

  const { setMessages, reply, streamStatus, error } = useOpenAIStream(OPEN_AI_MODEL, temperature);

  const reportInteraction = (item: AutoGenerateItem, otherMetadata?: object) =>
    reportAutoGenerateInteraction(eventTrackingSrc, item, otherMetadata);

  const isStreamGenerating = streamStatus === StreamStatus.GENERATING;

  useEffect(() => {
    if (!isStreamGenerating && reply !== '') {
      setCurrentIndex(1);
    }
  }, [isStreamGenerating, reply]);

  useEffect(() => {
    if (streamStatus === StreamStatus.COMPLETED) {
      // TODO: Break out sanitize regex into shared util function
      updateHistory(reply.replace(/^"|"$/g, ''));
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

  const onSubmit = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onGenerateWithFeedback(event.currentTarget.value);
      reportInteraction(AutoGenerateItem.customPrompt, { customPrompt: event.currentTarget.value });
    }
  };

  const onApply = () => {
    onApplySuggestion(history[currentIndex - 1]);
  };

  const onNavigate = (index: number) => {
    setCurrentIndex(index);
    reportInteraction(index > currentIndex ? AutoGenerateItem.backHistoryItem : AutoGenerateItem.forwardHistoryItem);
  };

  const onGenerateWithFeedback = (suggestion: string | QuickFeedbackType) => {
    if (suggestion !== QuickFeedbackType.Regenerate) {
      messages = [...messages, ...getFeedbackMessage(history[currentIndex], suggestion)];
    }

    setMessages(messages);
    reportInteraction(AutoGenerateItem.quickFeedback, { quickFeedbackItem: suggestion });
  };

  return (
    <div className={styles.wrapper}>
      {showError && (
        <div>
          <Alert title="">
            <VerticalGroup>
              <div>Sorry, I was unable to complete your request. Please try again.</div>
            </VerticalGroup>
          </Alert>
        </div>
      )}

      <Input
        placeholder="Tell AI what to do next..."
        suffix={<Icon name="corner-down-right-alt" />}
        onKeyDown={onSubmit}
      />
      <div className={styles.actions}>
        <QuickFeedback onSuggestionClick={onGenerateWithFeedback} isGenerating={isStreamGenerating} />
        <GenerationHistoryCarousel
          history={history}
          index={currentIndex}
          onNavigate={onNavigate}
          reply={reply.replace(/^"|"$/g, '')}
          streamStatus={streamStatus}
        />
      </div>
      <div className={styles.footerActions}>
        <HorizontalGroup justify={'flex-end'}>
          {isStreamGenerating && <Spinner />}
          <Button onClick={onApply} className={styles.applyButton} disabled={isStreamGenerating}>
            Apply
          </Button>
        </HorizontalGroup>
      </div>
      <Divider />
      <div className={styles.textWrapper}>
        <Icon name="exclamation-circle" aria-label="exclamation-circle" className={styles.infoColor} />
        <Text variant="bodySmall" element="p" color="secondary">
          Be aware that this content was AI-generated.{' '}
          <Link
            className={styles.linkText}
            href={'https://grafana.com/docs/grafana/latest/'}
            target="_blank"
            onClick={() => reportInteraction(AutoGenerateItem.linkToDocs)}
          >
            Learn more
          </Link>
        </Text>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    width: 520,
  }),
  footerActions: css({
    marginTop: 30,
  }),
  applyButton: css({
    width: 70,
  }),
  actions: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
  }),
  textWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    marginBottom: -15,
    lineHeight: 18,
    gap: 5,
  }),
  infoColor: css({
    color: theme.colors.info.main,
  }),
  linkText: css({
    color: theme.colors.text.link,
    textDecoration: 'none !important',
  }),
});
