import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { QuickFeedback } from './utils';

interface QuickActionsProps {
  onSuggestionClick: (suggestion: QuickFeedback) => void;
}

export const QuickActions = ({ onSuggestionClick }: QuickActionsProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.quickSuggestionsWrapper}>
      <Button onClick={() => onSuggestionClick(QuickFeedback.shorter)} size="sm" variant="secondary">
        {QuickFeedback.shorter}
      </Button>
      <Button onClick={() => onSuggestionClick(QuickFeedback.moreDescriptive)} size="sm" variant="secondary">
        {QuickFeedback.moreDescriptive}
      </Button>
      <Button onClick={() => onSuggestionClick(QuickFeedback.regenerate)} size="sm" variant="secondary">
        {QuickFeedback.regenerate}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  quickSuggestionsWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexGrow: 1,
    gap: 8,
    paddingTop: 10,
  }),
});
