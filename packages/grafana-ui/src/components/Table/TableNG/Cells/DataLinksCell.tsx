import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksCellProps } from '../types';
import { getCellLinks } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const styles = useStyles2(getStyles);
  const links = useMemo(() => getCellLinks(field, rowIdx!), [field, rowIdx]);

  if (!links || links.length === 0) {
    return null;
  }

  // the container span is needed to make the ::after work correctly.
  return (
    <span>
      {links.map((link, idx) =>
        !link.href && link.onClick == null ? (
          <span key={idx} className={styles.linkCell}>
            {link.title}
          </span>
        ) : (
          <a
            className={cx(styles.linkCell, styles.linkCellActive)}
            key={idx}
            onClick={link.onClick}
            href={link.href}
            target={link.target}
          >
            {link.title}
          </a>
        )
      )}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  linkCell: css({
    flexShrink: 0,
    userSelect: 'text',
    fontWeight: theme.typography.fontWeightMedium,
    '&::after': {
      display: 'inline-block',
      color: theme.colors.text.primary,
      content: '","',
      textDecoration: 'none',
      paddingInlineEnd: theme.spacing(0.5),
    },
    '&:last-child::after': {
      content: 'none',
      paddingInlineEnd: 0,
    },
  }),
  linkCellActive: css({
    cursor: 'pointer',
    color: theme.colors.text.link,
    a: {
      color: theme.colors.text.link,
    },
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});
