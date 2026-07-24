import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { forwardRef, type ForwardedRef, type ReactElement, type ReactNode, type RefAttributes } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useFlagGrafanaGrowthHomepage } from '@grafana/runtime/internal';
import { Alert, Badge, Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { HomeSection } from '../HomeSection';

import { CARD_LIST_MAX_HEIGHT } from './constants';

interface SummaryCardProps<T> {
  title: string;
  // Header count badge: red when count > 0. When countLimit is set and count >= countLimit the badge
  // reads `${countLimit}+` (server-capped data); otherwise the exact count.
  count?: number;
  countLimit?: number;
  // Right-aligned header content (e.g. a severity breakdown). Hidden while loading.
  headerExtra?: ReactNode;
  loading: boolean;
  // When set, replaces the list/empty state with a retryable warning alert.
  error?: { title: string; onRetry: () => void };
  emptyMessage: string;
  // Rendered in the empty state in place of emptyMessage — a call-to-action button. Caller gates it.
  emptyAction?: ReactNode;
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  // Footer element, already gated by the caller. Omit to render no footer.
  footer?: ReactNode;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const SummaryCard = forwardRef(function SummaryCard<T>(
  {
    title,
    count = 0,
    countLimit,
    headerExtra,
    loading,
    error,
    emptyMessage,
    emptyAction,
    items,
    getItemKey,
    renderItem,
    footer,
  }: SummaryCardProps<T>,
  ref: ForwardedRef<HTMLUListElement>
) {
  const redesignEnabled = useFlagGrafanaGrowthHomepage();
  const styles = useStyles2(getStyles);

  const countText = countLimit !== undefined && count >= countLimit ? `${countLimit}+` : String(count);

  const content = (
    <>
      <Stack direction="column" gap={2} grow={1}>
        {!redesignEnabled && (
          <Stack alignItems="center" justifyContent="space-between">
            <Stack alignItems="center">
              <Text element="h2" variant="h5">
                {title}
              </Text>
              {!loading && count > 0 && <Badge text={countText} color="red" />}
            </Stack>
            {!loading && headerExtra}
          </Stack>
        )}

        {loading && (
          <Stack direction="column">
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
            {emptyAction ?? <Text color="secondary">{emptyMessage}</Text>}
          </Stack>
        )}

        {!loading && !error && items.length > 0 && (
          <ul ref={ref} className={redesignEnabled ? undefined : styles.list}>
            {items.map((item) => (
              <li key={getItemKey(item)} className={!redesignEnabled ? styles.rowPadding : undefined}>
                {renderItem(item)}
              </li>
            ))}
          </ul>
        )}
      </Stack>

      {!loading && !error && footer && <Stack justifyContent="flex-end">{footer}</Stack>}
    </>
  );

  if (redesignEnabled) {
    return content;
  }

  return (
    // minWidth={0} lets the card shrink within the homepage grid so a long alert name
    // can't stretch this column wider than its sibling.
    <HomeSection display="flex" direction="column" minWidth={0}>
      <Stack direction="column" gap={2} grow={1}>
        {content}
      </Stack>
    </HomeSection>
  );
}) as <T>(props: SummaryCardProps<T> & RefAttributes<HTMLUListElement>) => ReactElement | null;

/** Left-aligned fixed-width prefix cell so titles align across rows. */
export function SummaryCardPrefix({ children }: { children: ReactNode }) {
  const styles = useStyles2(getStyles);
  return <span className={styles.prefix}>{children}</span>;
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
  rowPadding: css({
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
  }),
  age: css({
    marginLeft: 'auto',
    flexShrink: 0,
    minWidth: theme.spacing(10),
    display: 'inline-flex',
    justifyContent: 'flex-end',
  }),
  prefix: css({
    display: 'inline-flex',
    flexShrink: 0,
    // Reserves a fixed column for the severity badge ("Critical" is the widest label)
    // so titles align across rows.
    minWidth: theme.spacing(8),
    justifyContent: 'flex-start',
  }),
});
