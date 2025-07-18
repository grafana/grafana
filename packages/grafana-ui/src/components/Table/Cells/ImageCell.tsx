import { useState } from 'react';

import { getCellLinks } from '../../../utils/table';
import { DataLinksActionsTooltip, renderSingleLink } from '../DataLinksActionsTooltip';
import { TableCellDisplayMode, TableCellProps } from '../types';
import {
  tooltipOnClickHandler,
  DataLinksActionsTooltipCoords,
  getCellOptions,
  getDataLinksActionsTooltipUtils,
} from '../utils';

const DATALINKS_HEIGHT_OFFSET = 10;

export const ImageCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps } = props;
  const cellOptions = getCellOptions(field);
  const { title, alt } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { title: undefined, alt: undefined };
  const displayValue = field.display!(cell.value);

  const links = getCellLinks(field, row) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  // The image element
  const img = (
    <img
      style={{ height: tableStyles.cellHeight - DATALINKS_HEIGHT_OFFSET, width: 'auto' }}
      src={displayValue.text}
      className={tableStyles.imageCell}
      alt={alt}
      title={title}
    />
  );

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      {...cellProps}
      className={tableStyles.cellContainer}
      style={{ ...cellProps.style, cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={tooltipOnClickHandler(setTooltipCoords)}
    >
      {/* If there are data links/actions, we render them with image */}
      {/* Otherwise we simply render the image */}
      {shouldShowLink ? (
        renderSingleLink(links[0], img)
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          value={img}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : (
        img
      )}
    </div>
  );
};
