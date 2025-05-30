import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useState } from 'react';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { TableCellDisplayMode, TableCellOptions } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksActionsTooltip, renderSingleLink } from '../../DataLinksActionsTooltip';
import { DataLinksActionsTooltipCoords, getDataLinksActionsTooltipUtils } from '../../utils';
import { AutoCellProps } from '../types';
import { getCellLinks } from '../utils';

export default function AutoCell({ value, field, justifyContent, rowIdx, cellOptions, actions }: AutoCellProps) {
  const styles = useStyles2(getStyles, justifyContent);

  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const links = getCellLinks(field, rowIdx) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links, actions);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={styles.cell}
      onClick={({ clientX, clientY }) => setTooltipCoords({ clientX, clientY })}
      style={{ cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      data-testid={selectors.components.TablePanel.autoCell}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], formattedValue, getLinkStyle(styles, cellOptions))
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          actions={actions}
          value={formattedValue}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : (
        formattedValue
      )}
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
