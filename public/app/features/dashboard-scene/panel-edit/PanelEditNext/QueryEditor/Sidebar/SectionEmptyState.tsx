import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { SIDEBAR_CARD_HEIGHT, SIDEBAR_CARD_INDENT } from '../../constants';

interface SectionEmptyStateProps {
  message: string;
}

/**
 * Lightweight placeholder shown inside a sidebar section that has no cards. Kept intentionally
 * minimal — the section's "+" button is the action, so this only signals the section is empty
 * rather than broken or still loading.
 */
export function SectionEmptyState({ message }: SectionEmptyStateProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Text variant="bodySmall" color="secondary" textAlignment="center">
        {message}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Match the sidebar card footprint (width via the same horizontal inset, height, radius) so the
  // placeholder lines up with real cards; the dashed border distinguishes it as an empty slot.
  container: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing(SIDEBAR_CARD_INDENT),
    marginRight: theme.spacing(SIDEBAR_CARD_INDENT),
    minHeight: SIDEBAR_CARD_HEIGHT,
    padding: theme.spacing(0.5, 1),
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
  }),
});
