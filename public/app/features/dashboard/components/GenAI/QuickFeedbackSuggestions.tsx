import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

interface QuickFeedbackSuggestionsProps {}

export const QuickFeedbackSuggestions = ({}: QuickFeedbackSuggestionsProps) => {
  const styles = useStyles2(getStyles);

  const onSuggestionClick = (suggestion: string) => {};

  return (
    <div className={styles.quickSuggestionsWrapper}>
      <Button onClick={() => onSuggestionClick('Even shorter')} size="sm" variant="secondary">
        Even shorter
      </Button>
      <Button onClick={() => onSuggestionClick('More descriptive')} size="sm" variant="secondary">
        More descriptive
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  quickSuggestionsWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    flex-grow: 1;
    gap: 8px;
    padding-top: 10px;
  `,
});
