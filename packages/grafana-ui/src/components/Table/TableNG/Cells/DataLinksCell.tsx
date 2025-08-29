import { css } from '@emotion/css';

import { DataLinksCellProps, TableCellStyles } from '../types';
import { getCellLinks, getJustifyContent } from '../utils';

export const DataLinksCell = ({ field, rowIdx }: DataLinksCellProps) => {
  const links = getCellLinks(field, rowIdx);

  if (!links?.length) {
    return null;
  }

  return links.map((link, idx) => (
    <a key={idx} onClick={link.onClick} href={link.href} target={link.target}>
      {link.title}
    </a>
  ));
};

export const getStyles: TableCellStyles = (theme, { textWrap, textAlign }) =>
  css({
    ...(textWrap && {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: getJustifyContent(textAlign),
    }),
    '> a': {
      flexWrap: 'nowrap',
      ...(!textWrap && {
        paddingInline: theme.spacing(0.5),
        borderRight: `2px solid ${theme.colors.border.medium}`,
        '&:first-child': {
          paddingInlineStart: 0,
        },
        '&:last-child': {
          paddingInlineEnd: 0,
          borderRight: 'none',
        },
      }),
    },
  });
