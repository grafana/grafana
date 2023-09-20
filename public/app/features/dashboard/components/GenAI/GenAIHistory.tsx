import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Divider, Icon, Input, Link, Text, useStyles2 } from '@grafana/ui';

import { GenerationHistoryCarousel } from './GenerationHistoryCarousel';
import { QuickFeedbackSuggestions } from './QuickFeedbackSuggestions';

export interface GenAIHistoryProps {
  history: string[];
}

export const GenAIHistory = ({ history }: GenAIHistoryProps) => {
  const styles = useStyles2(getStyles);

  const [currentIndex, setCurrentIndex] = useState(1);

  const onSubmit = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      console.log('on enter');
    }
  };

  const onNavigate = (index: number) => {
    setCurrentIndex(index);
  };

  const onApply = () => {
    console.log('onApply');
  };

  // @TODO remove this after history re-generation implementation
  history = [...history, ...['History Item 2', 'History Item 3']];

  return (
    <div className={styles.wrapper}>
      <Input
        placeholder="Tell AI what to do next..."
        suffix={<Icon name="corner-down-right-alt" />}
        onKeyDown={onSubmit}
      />
      <div className={styles.actions}>
        <QuickFeedbackSuggestions />
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
  wrapper: css`
    display: flex;
    flex-direction: column;
    width: 520px;
  `,
  applyButton: css`
    display: flex;
    align-self: flex-end;
    width: 70px;
    margin-top: 30px;
  `,
  actions: css`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  `,
  textWrapper: css`
    margin-bottom: -15px;
  `,
  infoColor: css`
    color: ${theme.colors.info.main};
    margin-right: 5px;
  `,
  linkText: css`
    color: ${theme.colors.text.link} !important;
    text-decoration: none !important;
  `,
});
