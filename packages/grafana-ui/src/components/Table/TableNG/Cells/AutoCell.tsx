import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { TableCellOptions, TableCellDisplayMode } from '../../types';
import { useSingleLink } from '../hooks';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, justifyContent, rowIdx, cellOptions }: AutoCellProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const link = useSingleLink(field, rowIdx);

  return (
    <div className={styles.cell}>
      {link == null ? formattedValue : renderSingleLink(link, formattedValue, getLinkStyle(styles, cellOptions))}
    </div>
  );
}

const getLinkStyle = (styles: ReturnType<typeof getStyles>, cellOptions: TableCellOptions) => {
  if (cellOptions.type === TableCellDisplayMode.Auto) {
    return styles.linkCell;
  }

  return styles.cellLinkForColoredCell;
};

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent | undefined) => ({
  cell: css({
    display: 'flex',
    justifyContent: justifyContent,
    a: {
      color: 'inherit',
    },
  }),
  cellLinkForColoredCell: css({
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'text',
    whiteSpace: 'nowrap',
    fontWeight: theme.typography.fontWeightMedium,
    textDecoration: 'underline',
  }),
  linkCell: css({
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'text',
    whiteSpace: 'nowrap',
    color: `${theme.colors.text.link} !important`,
    fontWeight: theme.typography.fontWeightMedium,
    paddingRight: theme.spacing(1.5),
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});
