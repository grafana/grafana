import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Alert, Badge, Button, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { HomeSection } from '../HomeSection';

import { CARD_LIST_MAX_HEIGHT } from './constants';

interface SummaryCardProps<T> {
  title: string;
  // Header count badge: red when count > 0. When countLimit is set and count >= countLimit the badge
  // reads `${countLimit}+` (server-capped data); otherwise the exact count.
  count: number;
  countLimit?: number;
  // Right-aligned header content (e.g. a severity breakdown). Hidden while loading.
  headerExtra?: ReactNode;
  loading: boolean;
  // When set, replaces the list/empty state with a retryable warning alert.
  error?: { title: string; onRetry: () => void };
  emptyMessage: string;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  // Footer element, already gated by the caller. Omit to render no footer.
  footer?: ReactNode;
}

export function SummaryCard<T>({
  title,
  count,
  countLimit,
  headerExtra,
  loading,
  error,
  emptyMessage,
  items,
  getItemKey,
  renderItem,
  footer,
}: SummaryCardProps<T>) {
  const styles = useStyles2(getStyles);

  const countText = countLimit !== undefined && count >= countLimit ? `${countLimit}+` : String(count);

  return (
    <HomeSection display="flex" direction="column">
      <Stack direction="column" gap={2} grow={1}>
        <Stack direction="column" gap={2} grow={1}>
          <Stack alignItems="center" justifyContent="space-between">
            <Stack alignItems="center">
              <Text element="h2" variant="h5">
                {title}
              </Text>
              {!loading && count > 0 && <Badge text={countText} color="red" />}
            </Stack>
            {!loading && headerExtra}
          </Stack>

          {loading && (
            <Stack direction="column">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} height={20} />
              ))}
            </Stack>
          )}

          {error && (
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
            <Stack direction="column" alignItems="center">
              <Text color="secondary">{emptyMessage}</Text>
            </Stack>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={getItemKey(item)} className={styles.row}>
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          )}
        </Stack>

        {!loading && !error && footer && <Stack justifyContent="flex-end">{footer}</Stack>}
      </Stack>
    </HomeSection>
  );
}

/** Item title: a plugin/detail link when `href` is set, otherwise plain truncated text. */
export function SummaryCardTitle({ href, children }: { href?: string; children: string }) {
  const styles = useStyles2(getStyles);
  if (href) {
    return (
      <TextLink href={href} inline={false} className={styles.title}>
        {children}
      </TextLink>
    );
  }
  return <Text truncate>{children}</Text>;
}

/** Right-aligned relative-time cell shared by both cards. */
export function SummaryCardAge({ date }: { date: Date | number }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.age}>
      <Text color="secondary" variant="bodySmall">
        {formatDistanceToNowStrict(date, { addSuffix: true })}
      </Text>
    </span>
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
  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
  }),
});
