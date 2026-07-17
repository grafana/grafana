import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { CARD_LIST_MAX_HEIGHT } from './constants';

interface SummaryCardBodyProps<T> {
  loading: boolean;
  // When set, replaces the list/empty state with a retryable warning alert.
  error?: { title: string; onRetry: () => void };
  emptyMessage: string;
  // Rendered in the empty state in place of emptyMessage — a call-to-action button. Caller gates it.
  emptyAction?: ReactNode;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

/**
 * Shared loading / error / empty / list rendering for the alerts and incidents cards.
 * Kept separate from the card chrome so the legacy SummaryCard and the redesigned
 * FiringAlertsCard layout can both render it.
 */
export function SummaryCardBody<T>({
  loading,
  error,
  emptyMessage,
  emptyAction,
  items,
  getItemKey,
  renderItem,
}: SummaryCardBodyProps<T>) {
  const styles = useStyles2(getStyles);

  if (loading) {
    return (
      <Stack direction="column">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        title={error.title}
        action={
          <Button onClick={error.onRetry} variant="secondary" size="sm">
            <Trans i18nKey="home.summary-card.retry">Retry</Trans>
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <Stack direction="column" alignItems="center">
        {emptyAction ?? <Text color="secondary">{emptyMessage}</Text>}
      </Stack>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={getItemKey(item)} className={styles.row}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    maxHeight: CARD_LIST_MAX_HEIGHT,
    overflowY: 'auto',
    // Negative margin + matching padding gives the scrollbar a gutter clear of the age column
    // while keeping that column's right edge aligned with the sibling cards.
    marginRight: theme.spacing(-2),
    paddingRight: theme.spacing(2),
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    minWidth: 0,
  }),
});
