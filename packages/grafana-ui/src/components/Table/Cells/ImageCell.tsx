import { useState } from 'react';

import { getCellLinks } from '../../../utils';
import { DataLinksActionsTooltip } from '../DataLinksActionsTooltip';
import { TableCellDisplayMode, TableCellProps } from '../types';
import { DataLinksActionsTooltipCoords, getCellOptions, getDataLinksActionsTooltipUtils } from '../utils';

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
    <div
      {...cellProps}
      className={tableStyles.cellContainer}
      style={{ ...cellProps.style, cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={({ clientX, clientY }) => {
        setTooltipCoords({ clientX, clientY });
      }}
    >
      {/* If there are data links/actions, we render them with image */}
      {/* Otherwise we simply render the image */}
      {shouldShowLink ? (
        <a href={links[0].href} onClick={links[0].onClick} target={links[0].target} title={links[0].title}>
          {img}
        </a>
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
