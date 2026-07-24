import { css, cx } from '@emotion/css';
import type { MouseEvent, ReactNode } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Text, Stack, Link } from '@grafana/ui';

interface ListRowProps {
  title: string;
  subtitle?: string;
  prefix?: ReactNode;
  trailing?: ReactNode;
  // isCompact is used to make the row leaner (less spacing)
  isCompact?: boolean;
  // oneRow is used to make the row only one row (subtitle will be inline with title)
  oneRow?: boolean;
  href?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  // Row divider + padding chrome. Set false for a flush row that matches the
  // pre-redesign homepage cards. Defaults to true.
  showDivider?: boolean;
}

export function ListRow({
  title,
  subtitle,
  trailing,
  isCompact,
  oneRow,
  href,
  onClick,
  prefix,
  showDivider = true,
}: ListRowProps) {
  const styles = useStyles2(getStyles);

  const subtitleDisplay = subtitle && (
    <Text truncate color="secondary" variant="bodySmall" element="p">
      {subtitle}
    </Text>
  );

  const content = (
    <Stack
      direction={oneRow ? 'row' : 'column'}
      gap={oneRow ? 1 : 0}
      alignItems={oneRow ? 'center' : 'stretch'}
      grow={1}
      minWidth={0}
    >
      {/* Title */}
      <Text truncate element="p">
        {title}
      </Text>
      {/* Subtitle */}
      {subtitleDisplay}
    </Stack>
  );

  return (
    <div className={cx(styles.row, isCompact && styles.listCompact, !showDivider && styles.flush)}>
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

      {trailing && <div>{trailing}</div>}
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
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  listCompact: css({
    margin: 0,
  }),
  // Prevents a long title from squeezing the prefix; width policy stays with callers.
  prefixCell: css({
    flexShrink: 0,
  }),
  flush: css({
    borderBottom: 'none',
    padding: 0,
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
