import React, { FC, useEffect, useState } from 'react';
import { Cell } from 'react-table';
import { GrafanaTableColumn, TableCellDisplayMode, TableFieldOptions, TableFilterActionCallback } from './types';
import { TableStyles } from './styles';
import { useStyles2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { IconButton } from '../IconButton/IconButton';
import { isString } from 'lodash';
import { Modal } from '../Modal/Modal';
import { CodeEditor } from '../Monaco/CodeEditor';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { getTextAlign } from './utils';
import { GrafanaTheme2 } from '@grafana/data';
import { getTextColorForBackground } from '../../utils';
import { Icon } from '../Icon/Icon';
export interface Props {
  cell: Cell;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
  columnIndex: number;
  columnCount: number;
}

export const TableCell: FC<Props> = ({ cell, tableStyles, onCellFilterAdded, columnIndex, columnCount }) => {
  const [isPreview, setIsPreview] = useState(false);
  const styles = useStyles2(getStyles);

  const cellProps = cell.getCellProps();
  const field = (cell.column as any as GrafanaTableColumn).field;
  const previewEnabled = (field.config.custom as TableFieldOptions)?.preview;
  const displayMode = (field.config.custom as TableFieldOptions)?.displayMode;
  const previewMode = displayMode === TableCellDisplayMode.JSONView ? 'code' : 'text';

  const displayValue = field.display!(cell.value);
  const iconColor =
    displayMode === TableCellDisplayMode.ColorBackground || displayMode === TableCellDisplayMode.ColorBackgroundSolid
      ? getTextColorForBackground(displayValue.color!)
      : undefined;

  const isRightAligned =
    getTextAlign(field) === 'flex-end' &&
    displayMode !== TableCellDisplayMode.BasicGauge &&
    displayMode !== TableCellDisplayMode.LcdGauge &&
    displayMode !== TableCellDisplayMode.GradientGauge;

  if (!field.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.minWidth = cellProps.style.width;
    cellProps.style.justifyContent = (cell.column as any).justifyContent;
  }

  let innerWidth = ((cell.column.width as number) ?? 24) - tableStyles.cellPadding * 2;

  // last child sometimes have extra padding if there is a non overlay scrollbar
  if (columnIndex === columnCount - 1) {
    innerWidth -= tableStyles.lastChildExtraPadding;
  }

  const { style, ...otherCellProps } = cellProps;
  const { justifyContent, ...commonCellStyles } = style || {};

  return (
    <div className={cx(styles.container, !previewEnabled && styles.containerHover)} style={commonCellStyles}>
      {
        cell.render('Cell', {
          field,
          tableStyles,
          onCellFilterAdded,
          cellProps: {
            style: { justifyContent },
            ...otherCellProps,
          },
          innerWidth,
        }) as React.ReactElement
      }
      {previewEnabled && (
        <>
          <div
            className={cx(
              'actions',
              isRightAligned && 'actionsLeft',
              css`
                svg {
                  color: ${iconColor};
                }
              `
            )}
            style={iconColor && { background: 'none' }}
          >
            <IconButton
              name="eye"
              size="sm"
              onClick={() => {
                setIsPreview(true);
              }}
            />
          </div>
          {isPreview && (
            <TableCellPreviewModal
              mode={previewMode}
              value={cell.value}
              onDismiss={() => {
                setIsPreview(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

interface TableCellPreviewModalProps {
  value: any;
  onDismiss: () => void;
  mode: 'code' | 'text';
}

function TableCellPreviewModal({ value, onDismiss, mode }: TableCellPreviewModalProps) {
  const [isInClipboard, setIsInClipboard] = useState(false);
  const timeoutRef = React.useRef<number>();

  useEffect(() => {
    if (isInClipboard) {
      timeoutRef.current = window.setTimeout(() => {
        setIsInClipboard(false);
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isInClipboard]);

  let displayValue = value;
  if (isString(value)) {
    try {
      value = JSON.parse(value);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(value, null, ' ');
  }
  let text = displayValue;

  if (mode === 'code') {
    text = JSON.stringify(value, null, ' ');
  }

  return (
    <Modal onDismiss={onDismiss} isOpen={true} title="Preview">
      {mode === 'code' ? (
        <CodeEditor
          width="100%"
          height={500}
          language="json"
          showLineNumbers={true}
          showMiniMap={(text && text.length) > 100}
          value={text}
          readOnly={true}
        />
      ) : (
        <pre>{text}</pre>
      )}
      <Modal.ButtonRow>
        <ClipboardButton getText={() => text} onClipboardCopy={() => setIsInClipboard(true)}>
          {!isInClipboard ? (
            'Copy to Clipboard'
          ) : (
            <>
              <Icon name="check" />
              Copied to clipboard
            </>
          )}
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      .actions {
        display: flex;
        visibility: hidden;
        opacity: 0;
        align-items: center;
        height: 100%;
        position: absolute;
        top: 0;
        right: 0;
        padding: ${theme.spacing(1, 0.5, 1, 0.5)};
        background: ${theme.colors.emphasize(theme.colors.background.primary, 0.03)};
        transform: translate3d(50%, 0, 0);
        transition: all 0.1s ease-in-out;
      }
      &:hover {
        .cell-filter-actions  {
          display: inline-flex;
        }
        .actions {
          visibility: visible;
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        .actionsLeft {
          transform: translate3d(0, 0, 0) !important;
        }
      }
      .actionsLeft {
        right: auto !important;
        transform: translate3d(-50%, 0, 0) !important;
        left: 0;
      }
    `,

    containerHover: css`
      &:hover {
        overflow: visible;
        width: auto !important;
        z-index: 1;
      }
    `,
  };
};
