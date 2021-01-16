import React, { FC, useState } from 'react';
import { isString } from 'lodash';
import { cx } from 'emotion';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { Modal } from '../Modal/Modal';
import { TableCellProps, TableCellPopupDisplayMode } from './types';

export const PopupCell: FC<TableCellProps> = props => {
  const [popupState, setPopupState] = useState(false);
  const { cell, tableStyles, cellProps } = props;
  const popupDisplayMode = props.field?.config?.custom?.popupDisplayMode || 'auto';
  return (
    <>
      <div {...cellProps} className={tableStyles.cellContainer} onClick={() => setPopupState(true)}>
        <div className={cx(tableStyles.cellText)}>{cell.value}</div>
      </div>
      <Modal title="More Details" isOpen={popupState} onDismiss={() => setPopupState(false)}>
        <PopupCellContent value={cell.value} mode={popupDisplayMode} />
      </Modal>
    </>
  );
};

interface PopupCellContentProps {
  mode: TableCellPopupDisplayMode;
  value: any;
}

const PopupCellContent: FC<PopupCellContentProps> = props => {
  const { value, mode } = props;
  let json = {};
  if (isString(value)) {
    try {
      json = JSON.parse(value);
    } catch {
      json = { value };
    }
  }
  switch (mode) {
    case TableCellPopupDisplayMode.JSON:
      return <JSONFormatter json={json} open={4} />;
    case TableCellPopupDisplayMode.Code:
      return <pre>{value}</pre>;
    case TableCellPopupDisplayMode.Auto:
    default:
      return <>{value}</>;
  }
};
