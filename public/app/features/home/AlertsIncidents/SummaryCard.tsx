import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Badge, type BadgeColor, Text, TextLink, useStyles2 } from '@grafana/ui';

import { HomeDataCard } from './HomeDataCard';

interface SummaryCardProps<T> {
  title: string;
  // Header count badge: red when count > 0. When countLimit is set and count >= countLimit the badge
  // reads `${countLimit}+` (server-capped data); otherwise the exact count.
  count: number;
  countLimit?: number;
  // Tone of the header count badge; defaults to 'red' (positive count = bad). Set 'blue' for neutral counts.
  countColor?: BadgeColor;
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
  countColor,
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
    <HomeDataCard
      title={title}
      titleBadge={count > 0 ? <Badge text={countText} color={countColor ?? 'red'} /> : undefined}
      headerActions={headerExtra}
      loading={loading}
      error={error}
      isEmpty={items.length === 0}
      emptyMessage={emptyMessage}
      footer={footer}
    >
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={getItemKey(item)} className={styles.row}>
            {renderItem(item)}
          </li>
        ))}
      </ul>
    </HomeDataCard>
  );
}

/** Item title: a plugin/detail link when `href` is set, otherwise plain truncated text. */
export function SummaryCardTitle({ href, children }: { href?: string; children: string }) {
  const styles = useStyles2(getStyles);
  if (href) {
    return (
      <TextLink href={href} inline={false} color="primary" className={styles.title}>
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

/** Right-aligned secondary text cell (e.g. a schedule name), shared with SummaryCardAge's column. */
export function SummaryCardMeta({ children }: { children: string }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.age}>
      <Text color="secondary" variant="bodySmall" truncate>
        {children}
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
    flex: 1,
    minHeight: 0,
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
