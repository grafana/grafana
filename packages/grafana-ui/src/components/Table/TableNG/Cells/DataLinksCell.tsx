import { css } from '@emotion/css';
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

  return (
    // the container span is needed to make the first-child and last-child CSS selectors work
    // without interacting with other elements, like the TableCellActions.
    <span>
      {links.map((link, idx) =>
        !link.href && link.onClick == null ? (
          <span key={idx} className={styles.linkCell}>
            {link.title}
          </span>
        ) : (
          <a key={idx} className={styles.linkCell} onClick={link.onClick} href={link.href} target={link.target}>
            {link.title}
          </a>
        )
      )}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2, textWrap?: boolean) => ({
  linkCell: css({
    display: textWrap ? 'block' : 'inline',
    userSelect: 'text',
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
    ...(!textWrap && {
      paddingInline: theme.spacing(1),
      borderRight: `2px solid ${theme.colors.border.medium}`,
      '&:first-child': {
        paddingInlineStart: 0,
      },
      '&:last-child': {
        borderRight: 'none',
        paddingInlineEnd: 0,
      },
    }),
  }),
});
