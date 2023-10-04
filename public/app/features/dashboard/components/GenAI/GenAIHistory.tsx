import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  Divider,
  HorizontalGroup,
  Icon,
  IconButton,
  Input,
  Spinner,
  Text,
  TextLink,
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
  const [customFeedback, setCustomPrompt] = useState('');

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

  const onSubmitCustomFeedback = (text: string) => {
    onGenerateWithFeedback(text);
    reportInteraction(AutoGenerateItem.customFeedback, { customFeedback: text });
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

    if (suggestion in QuickFeedbackType) {
      reportInteraction(AutoGenerateItem.quickFeedback, { quickFeedbackItem: suggestion });
    }
  };

  return (
    <div className={styles.container}>
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
        suffix={
          <IconButton
            name="corner-down-right-alt"
            variant="secondary"
            aria-label="Send custom suggestion"
            onClick={() => onSubmitCustomFeedback(customFeedback)}
            disabled={customFeedback === ''}
          />
        }
        value={customFeedback}
        onChange={(e) => setCustomPrompt(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmitCustomFeedback(customFeedback)}
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
      <div className={styles.applySuggestion}>
        <HorizontalGroup justify={'flex-end'}>
          {isStreamGenerating && <Spinner />}
          <Button onClick={onApply} disabled={isStreamGenerating}>
            Apply
          </Button>
        </HorizontalGroup>
      </div>
      <div className={styles.footer}>
        <Icon name="exclamation-circle" aria-label="exclamation-circle" className={styles.infoColor} />
        <Text variant="bodySmall" element="p" color="secondary">
          Be aware that this content was AI-generated.{' '}
          <TextLink
            variant="bodySmall"
            href="https://grafana.com/grafana/dashboards/"
            external
            onClick={() => reportInteraction(AutoGenerateItem.linkToDocs)}
          >
            Learn more
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
