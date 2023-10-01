import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, HorizontalGroup, Icon, Input, Link, Spinner, Text, useStyles2 } from '@grafana/ui';

import { getFeedbackMessage } from './GenAIPanelTitleButton';
import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickActions } from './QuickActions';
import { useOpenAIStream } from './hooks';
import { Message, OPEN_AI_MODEL, QuickFeedback } from './utils';

export interface GenAIHistoryProps {
  history: string[];
  onApplySuggestion: (suggestion: string) => void;
  updateHistory: (historyEntry: string) => void;
  messages: Message[];
}

const temperature = 0.5;

export const GenAIHistory = ({ history, messages, onApplySuggestion, updateHistory }: GenAIHistoryProps) => {
  const styles = useStyles2(getStyles);

  const [currentIndex, setCurrentIndex] = useState(1);
  const [response, setResponse] = useState<string>('');

  const { setMessages, reply, isGenerating } = useOpenAIStream(OPEN_AI_MODEL, temperature);

  useEffect(() => {
    if (reply !== '') {
      setResponse(reply.replace(/^"|"$/g, ''));
    }
  }, [reply]);

  useEffect(() => {
    if (response !== '' && !isGenerating) {
      setResponse('');
    }
  }, [response, isGenerating]);

  const onSubmit = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // @TODO: Implement
    }
  };

  const onApply = () => {
    onApplySuggestion(history[currentIndex - 1]);
  };

  const onNavigate = (index: number) => {
    setCurrentIndex(index);
  };

  const onGenerateWithFeedback = (suggestion: QuickFeedback, index: number) => {
    if (suggestion !== QuickFeedback.regenerate) {
      messages = [...messages, ...getFeedbackMessage(history[index], suggestion)];
    }

    setMessages(messages);
  };

  useEffect(() => {
    if (response !== '' && !isGenerating) {
      updateHistory(response);
    }
  }, [isGenerating, response, updateHistory]);

  return (
    <div className={styles.wrapper}>
      <Input
        placeholder="Tell AI what to do next..."
        suffix={<Icon name="corner-down-right-alt" />}
        onKeyDown={onSubmit}
      />
      <div className={styles.actions}>
        <QuickActions
          onSuggestionClick={(suggestion: QuickFeedback) => onGenerateWithFeedback(suggestion, currentIndex)}
        />
        <GenerationHistoryCarousel
          history={history}
          index={currentIndex}
          onNavigate={onNavigate}
          reply={reply.replace(/^"|"$/g, '')}
        />
      </div>
      <div className={styles.footerActions}>
        <HorizontalGroup justify={'flex-end'}>
          {isGenerating && <Spinner />}
          <Button onClick={onApply} className={styles.applyButton} disabled={isGenerating}>
            Apply
          </Button>
        </HorizontalGroup>
      </div>
      <Divider />
      <div className={styles.textWrapper}>
        <Icon name="exclamation-circle" aria-label="exclamation-circle" className={styles.infoColor} />
        <Text variant="bodySmall" element="p" color="secondary">
          Be aware that this content was AI-generated.{' '}
          <Link className={styles.linkText} href={'https://grafana.com/docs/grafana/latest/'} target="_blank">
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
