import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { QuickFeedbackType } from './utils';

interface QuickActionsProps {
  onSuggestionClick: (suggestion: string) => void;
  isGenerating: boolean;
}

export const QuickFeedback = ({ onSuggestionClick, isGenerating }: QuickActionsProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.quickSuggestionsWrapper}>
      <Button
        onClick={() => onSuggestionClick(QuickFeedbackType.Shorter)}
        size="sm"
        variant="secondary"
        icon="paragraph"
        disabled={isGenerating}
      >
        {QuickFeedbackType.Shorter}
      </Button>
      <Button
        onClick={() => onSuggestionClick(QuickFeedbackType.MoreDescriptive)}
        size="sm"
        variant="secondary"
        icon="document-layout-left"
        disabled={isGenerating}
      >
        {QuickFeedbackType.MoreDescriptive}
      </Button>
      <Button
        onClick={() => onSuggestionClick(QuickFeedbackType.Regenerate)}
        icon="sync"
        size="sm"
        variant="secondary"
        disabled={isGenerating}
      >
        {'Regenerate'}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  quickSuggestionsWrapper: css({
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  }),
});
