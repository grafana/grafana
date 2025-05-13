import { css, cx } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode, TableCellOptions } from '@grafana/schema';

import { useStyles2 } from '../../../../themes';
import { clearLinkButtonStyles } from '../../../Button';
import { DataLinksContextMenu } from '../../../DataLinks/DataLinksContextMenu';
import { AutoCellProps } from '../types';
import { getCellLinks } from '../utils';

export default function AutoCell({ value, field, justifyContent, rowIdx, cellOptions }: AutoCellProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const hasLinks = Boolean(getCellLinks(field, rowIdx)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div className={styles.cell}>
      {hasLinks ? (
        <DataLinksContextMenu links={() => getCellLinks(field, rowIdx) || []}>
          {(api) => {
            if (api.openMenu) {
              return (
                <button
                  className={cx(clearButtonStyle, getLinkStyle(styles, cellOptions, api.targetClassName))}
                  onClick={api.openMenu}
                >
                  {formattedValue}
                </button>
              );
            } else {
              return <div className={getLinkStyle(styles, cellOptions, api.targetClassName)}>{formattedValue}</div>;
            }
          }}
        </DataLinksContextMenu>
      ) : (
        formattedValue
      )}
    </div>
  );
}

const getLinkStyle = (
  styles: ReturnType<typeof getStyles>,
  cellOptions: TableCellOptions,
  targetClassName: string | undefined
) => {
  if (cellOptions.type === TableCellDisplayMode.Auto) {
    return cx(styles.linkCell, targetClassName);
  }

  return cx(styles.cellLinkForColoredCell, targetClassName);
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
    color: theme.colors.text.link,
    fontWeight: theme.typography.fontWeightMedium,
    paddingRight: theme.spacing(1.5),
    a: {
      color: theme.colors.text.link,
    },
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});
