import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack, Text, useStyles2 } from '@grafana/ui';
import { GrotCompleted } from '@grafana/ui/internal';

interface SummaryCardProps<T> {
  loading: boolean;
  // When set, replaces the list/empty state with a retryable warning alert.
  error?: { title: string; onRetry: () => void };
  emptyMessage: string;
  // Rendered in the empty state in place of emptyMessage — a call-to-action button. Caller gates it.
  emptyAction?: ReactNode;
  // Rendered above emptyMessage in the empty state.
  emptyImage?: ReactNode;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

export function SummaryCard<T>({
  loading,
  error,
  emptyMessage,
  emptyAction,
  emptyImage,
  items,
  getItemKey,
  renderItem,
}: SummaryCardProps<T>) {
  return (
    <Stack direction="column" gap={2} grow={1}>
      {loading && (
        <Stack direction="column" data-testid="summary-card-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={20} />
          ))}
        </Stack>
      )}

      {!loading && error && (
        <Alert
          severity="warning"
          title={error.title}
          action={
            <Button onClick={error.onRetry} variant="secondary" size="sm">
              <Trans i18nKey="home.summary-card.retry">Retry</Trans>
            </Button>
          }
        />
      )}

      {!loading && !error && items.length === 0 && (
        <Stack direction="column" grow={1} alignItems="center" justifyContent="center">
          {emptyImage}
          <Text color="secondary">{emptyMessage}</Text>
          {emptyAction}
        </Stack>
      )}

      {!loading && !error && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={getItemKey(item)}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

/** Happy Grot for an all-clear empty state, sized to fit the compact tab body. */
export function AllClearGrot() {
  const styles = useStyles2(getStyles);
  // Width matches the drawing's 269:196 ratio; without it the SVG box fills the whole card width.
  return <GrotCompleted width={88} height={64} className={styles.allClearGrot} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  allClearGrot: css({
    marginTop: theme.spacing(1),
  }),
});
