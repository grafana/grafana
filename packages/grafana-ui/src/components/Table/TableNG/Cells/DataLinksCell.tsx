import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksCellProps } from '../types';
import { getCellLinks, shouldTextWrap } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const textWrap = shouldTextWrap(field);
  const styles = useStyles2(getStyles, textWrap);
  const links = useMemo(() => getCellLinks(field, rowIdx!), [field, rowIdx]);

  if (!links || links.length === 0) {
    return null;
  }

  // the container span is needed to make the ::after work correctly.
  return links.map((link, idx) =>
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
  );
};

const getStyles = (theme: GrafanaTheme2, textWrap?: boolean) => ({
  linkCell: css({
    display: textWrap ? 'block' : 'inline',
    userSelect: 'text',
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
    ...(!textWrap && {
      paddingInline: theme.spacing(0.5),
      borderRight: `2px solid ${theme.colors.border.medium}`,
      '&:last-child': {
        borderRight: 'none',
      },
    }),
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
