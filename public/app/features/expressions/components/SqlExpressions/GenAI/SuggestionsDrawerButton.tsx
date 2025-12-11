import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

interface SuggestionsBadgeProps {
  suggestions: string[];
  handleOpenDrawer: () => void;
}

export const SuggestionsDrawerButton = ({ suggestions, handleOpenDrawer }: SuggestionsBadgeProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.buttonWrapper} data-testid="suggestions-badge">
      <Button variant="secondary" fill="outline" size="sm" onClick={handleOpenDrawer} icon="list-ol">
        <Stack direction="row" gap={1} alignItems="center">
          <Trans i18nKey="sql-expressions.suggestions">Suggestions</Trans>
          <span className={styles.countBadge}>
            <Text variant="bodySmall" weight="bold">
              {suggestions.length}
            </Text>
          </span>
        </Stack>
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  countBadge: css({
    color: theme.colors.primary.text,
    fontWeight: 'bold',
  }),
  buttonWrapper: css({
    position: 'relative',
    display: 'inline-block',
  }),
});
