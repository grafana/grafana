import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Text, Stack, Link } from '@grafana/ui';

interface ListRowProps {
  title: string;
  // Rendered inside a secondary bodySmall paragraph; a nested Text can restyle part or all of it.
  subtitle?: ReactNode;
  prefix?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function ListRow({ title, subtitle, trailing, href, onClick, prefix }: ListRowProps) {
  const styles = useStyles2(getStyles);

  const subtitleDisplay = subtitle && (
    <Text truncate color="secondary" variant="bodySmall" element="p">
      {subtitle}
    </Text>
  );

  const content = (
    <Stack direction="column" gap={0} grow={1} minWidth={0}>
      {/* Title */}
      <Text truncate element="p">
        {title}
      </Text>
      {/* Subtitle */}
      {subtitleDisplay}
    </Stack>
  );

  return (
    <div className={styles.row}>
      <Stack direction="row" alignItems="center" gap={1.5} grow={1} minWidth={0}>
        {prefix && <div className={styles.prefixCell}>{prefix}</div>}

        {href ? (
          <Link href={href} onClick={onClick} color="primary" className={styles.titleLink}>
            {content}
          </Link>
        ) : (
          content
        )}
      </Stack>

      {trailing && <div className={styles.trailingCell}>{trailing}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flex: 1,
    minWidth: 0,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
    // A truncated title or subtitle otherwise runs its ellipsis into the trailing cell.
    gap: theme.spacing(2),
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  // Prevents a long title from squeezing the prefix or trailing cells; width policy stays with callers.
  prefixCell: css({
    flexShrink: 0,
  }),
  trailingCell: css({
    flexShrink: 0,
  }),
  titleLink: css({
    flex: 1,
    minWidth: 0,
    '&:hover > div > p:first-child': {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
  }),
});
