import { css } from '@emotion/css';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Badge, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { HomeSection } from '../HomeSection';

import { SummaryCardBody } from './SummaryCardBody';

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
  // Rendered in the empty state in place of emptyMessage — a call-to-action button. Caller gates it.
  emptyAction?: ReactNode;
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
  emptyAction,
  items,
  getItemKey,
  renderItem,
  footer,
}: SummaryCardProps<T>) {
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

          <SummaryCardBody
            loading={loading}
            error={error}
            emptyMessage={emptyMessage}
            emptyAction={emptyAction}
            items={items}
            getItemKey={getItemKey}
            renderItem={renderItem}
          />
        </Stack>

        {!loading && !error && footer && <Stack justifyContent="flex-end">{footer}</Stack>}
      </Stack>
    </HomeSection>
  );
}

/** Item title: a plugin/detail link when `href` is set, otherwise plain truncated text. */
export function SummaryCardTitle({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: string;
}) {
  const styles = useStyles2(getStyles);
  if (href) {
    return (
      <TextLink href={href} onClick={onClick} inline={false} color="primary" className={styles.title}>
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
