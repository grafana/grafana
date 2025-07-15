import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

interface SuggestionsBadgeProps {
  suggestions: string[];
  handleOpenDrawer: () => void;
  hasUnseenSuggestions: boolean;
}

export const SuggestionsBadge = ({ suggestions, handleOpenDrawer, hasUnseenSuggestions }: SuggestionsBadgeProps) => {
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
      {hasUnseenSuggestions && <span className={styles.newDot} data-testid="suggestions-badge-dot" />}
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
  newDot: css({
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: theme.spacing(1),
    height: theme.spacing(1),
    backgroundColor: theme.colors.error.main,
    borderRadius: theme.shape.radius.pill,
    zIndex: 1,
  }),
});
