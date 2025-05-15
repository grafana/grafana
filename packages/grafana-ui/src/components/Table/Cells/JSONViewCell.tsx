import { css, cx } from '@emotion/css';
import { isString } from 'lodash';

import { useStyles2 } from '../../../themes';
import { Button, clearLinkButtonStyles } from '../../Button';
import { DataLinksContextMenu } from '../../DataLinks/DataLinksContextMenu';
import { CellActions } from '../CellActions';
import { TableCellInspectorMode } from '../TableCellInspector';
import { getCellLinks } from '../TableNG/utils';
import { TableCellProps } from '../types';

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

  const hasLinks = Boolean(getCellLinks(field, row.index)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div {...cellProps} className={inspectEnabled ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer}>
      <div className={cx(tableStyles.cellText, txt)}>
        {hasLinks ? (
          <DataLinksContextMenu links={() => getCellLinks(field, row.index) || []}>
            {(api) => {
              if (api.openMenu) {
                return (
                  <Button className={cx(clearButtonStyle)} onClick={api.openMenu}>
                    {displayValue}
                  </Button>
                );
              } else {
                return <>{displayValue}</>;
              }
            }}
          </DataLinksContextMenu>
        ) : (
          <div className={tableStyles.cellText}>{displayValue}</div>
        )}
      </div>
      {inspectEnabled && <CellActions {...props} previewMode={TableCellInspectorMode.code} />}
    </div>
  );
}
