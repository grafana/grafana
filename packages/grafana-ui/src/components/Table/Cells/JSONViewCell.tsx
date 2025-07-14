import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { useState } from 'react';

import { getCellLinks } from '../../../utils/table';
import { CellActions } from '../CellActions';
import { DataLinksActionsTooltip, renderSingleLink } from '../DataLinksActionsTooltip';
import { TableCellInspectorMode } from '../TableCellInspector';
import { TableCellProps } from '../types';
import { tooltipOnClickHandler, DataLinksActionsTooltipCoords, getDataLinksActionsTooltipUtils } from '../utils';

export function JSONViewCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps, field, row } = props;
  const inspectEnabled = Boolean(field.config.custom?.inspect);
  const txt = css({
    cursor: 'pointer',
    fontFamily: 'monospace',
  });

  let value = cell.value;
  let displayValue = value;

  if (isString(value)) {
    try {
      value = JSON.parse(value);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(value, null, ' ');
  }

  const links = getCellLinks(field, row) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  return (
    <div {...cellProps} className={inspectEnabled ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <div className={cx(tableStyles.cellText, txt)} onClick={tooltipOnClickHandler(setTooltipCoords)}>
        {shouldShowLink ? (
          renderSingleLink(links[0], displayValue)
        ) : shouldShowTooltip ? (
          <DataLinksActionsTooltip
            links={links}
            value={displayValue}
            coords={tooltipCoords}
            onTooltipClose={() => setTooltipCoords(undefined)}
          />
        ) : (
          <div className={tableStyles.cellText}>{displayValue}</div>
        )}
      </div>
      {inspectEnabled && <CellActions {...props} previewMode={TableCellInspectorMode.code} />}
    </div>
  );
}
