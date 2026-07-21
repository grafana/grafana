import { css, cx } from '@emotion/css';
import type { ReactNode } from 'react';

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
  onClick?: () => void;
}

export function ListRow({ title, subtitle, trailing, isCompact, oneRow, href, onClick, prefix }: ListRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.row, isCompact && styles.dashlistLinkCompact)}>
      <Stack direction="row" alignItems="center" gap={1} grow={1}>
        <div>{prefix}</div>

        {href ? (
          <Link href={href} onClick={onClick} color="primary" className={styles.titleLink} aria-label={title}>
            <Stack
              direction={oneRow ? 'row' : 'column'}
              gap={oneRow ? 1 : 0}
              alignItems={oneRow ? 'center' : 'flex-start'}
            >
              {/* Title */}
              <Text truncate element="p">
                {title}
              </Text>
              {/* Subtitle */}
              <Text truncate color="secondary" variant="bodySmall" element="p">
                {subtitle ?? ''}
              </Text>
            </Stack>
          </Link>
        ) : (
          <Stack
            direction={oneRow ? 'row' : 'column'}
            gap={oneRow ? 1 : 0}
            alignItems={oneRow ? 'center' : 'flex-start'}
            grow={1}
          >
            <Text truncate>{title}</Text>
            {/* Subtitle */}
            <Text truncate color="secondary" variant="bodySmall">
              {subtitle ?? ''}
            </Text>
          </Stack>
        )}
      </Stack>

      <div>{trailing}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(1),
    padding: theme.spacing(1),
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  }),
  dashlistLinkCompact: css({
    margin: 0,
  }),
  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  titleLink: css({
    flex: 1,
    '&:hover > div > p:first-child': {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
  }),
});
