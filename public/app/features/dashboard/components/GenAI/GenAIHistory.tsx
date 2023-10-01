import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, Icon, Input, Link, Text, useStyles2 } from '@grafana/ui';

import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedbackSuggestions } from './QuickFeedbackSuggestions';
import { QuickFeedback } from './utils';

export interface GenAIHistoryProps {
  history: string[];
  onGenerateWithFeedback: (suggestion: QuickFeedback, index: number) => void;
  onApplySuggestion: (suggestion: string) => void;
}

export const GenAIHistory = ({ history, onGenerateWithFeedback, onApplySuggestion }: GenAIHistoryProps) => {
  const styles = useStyles2(getStyles);

  const [currentIndex, setCurrentIndex] = useState(1);

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

  return (
    <div className={styles.wrapper}>
      <Input
        placeholder="Tell AI what to do next..."
        suffix={<Icon name="corner-down-right-alt" />}
        onKeyDown={onSubmit}
      />
      <div className={styles.actions}>
        <QuickFeedbackSuggestions
          onSuggestionClick={(suggestion: QuickFeedback) => onGenerateWithFeedback(suggestion, currentIndex)}
        />
        <GenerationHistoryCarousel history={history} index={currentIndex} onNavigate={onNavigate} />
      </div>
      <Button onClick={onApply} className={styles.applyButton}>
        Apply
      </Button>
      <Divider />
      <div className={styles.textWrapper}>
        <Text variant="bodySmall" element="p" color="secondary">
          <Icon name="exclamation-circle" aria-label="exclamation-circle" className={styles.infoColor} />
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
  applyButton: css({
    display: 'flex',
    alignSelf: 'flex-end',
    width: 70,
    marginTop: 30,
  }),
  actions: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
  }),
  textWrapper: css({
    marginBottom: -15,
  }),
  infoColor: css({
    color: theme.colors.info.main,
    marginRight: 5,
  }),
  linkText: css({
    color: theme.colors.text.link,
    textDecoration: 'none !important',
  }),
});
