import { css } from '@emotion/css';
import { memo, ReactNode, useMemo } from 'react';

import { LogRowModel, Field, LinkModel, DataFrame } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from './LogDetailsBody';
import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';
import { getAllFields } from './logParser';

export interface Props {
  row: LogRowModel;
  detectedFields: string[];
  wrapLogMessage: boolean;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  styles: LogRowStyles;
  showContextToggle?: (row: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  mouseIsOver: boolean;
  onBlur: () => void;
  logRowMenuIconsBefore?: ReactNode[];
  logRowMenuIconsAfter?: ReactNode[];
  preview?: boolean;
}

export const LogRowMessageDisplayedFields = memo((props: Props) => {
  const {
    row,
    detectedFields,
    getFieldLinks,
    wrapLogMessage,
    styles,
    mouseIsOver,
    pinned,
    logRowMenuIconsBefore,
    logRowMenuIconsAfter,
    preview,
    ...rest
  } = props;
  const wrapClassName = wrapLogMessage ? '' : displayedFieldsStyles.noWrap;
  const fields = useMemo(() => getAllFields(row, getFieldLinks), [getFieldLinks, row]);
  // only single key/value rows are filterable, so we only need the first field key for filtering
  const line = useMemo(() => {
    let line = '';
    for (let i = 0; i < detectedFields.length; i++) {
      const parsedKey = detectedFields[i];

      if (parsedKey === LOG_LINE_BODY_FIELD_NAME) {
        line += ` ${row.entry}`;
      }

      const field = fields.find((field) => {
        return field.keys[0] === parsedKey;
      });

      if (field != null) {
        line += ` ${parsedKey}=${field.values}`;
      }

      if (row.labels[parsedKey] != null && row.labels[parsedKey] != null) {
        line += ` ${parsedKey}=${row.labels[parsedKey]}`;
      }
    }
    return line.trimStart();
  }, [detectedFields, fields, row.entry, row.labels]);

  const shouldShowMenu = mouseIsOver || pinned;

  if (preview) {
    return (
      <>
        <td>
          <div>{line}</div>
        </td>
        <td></td>
      </>
    );
  }

  return (
    <>
      <td className={styles.logsRowMessage}>
        <div className={wrapClassName}>{line}</div>
      </td>
      <td className={`log-row-menu-cell ${styles.logRowMenuCell}`}>
        {shouldShowMenu && (
          <LogRowMenuCell
            logText={line}
            row={row}
            styles={styles}
            pinned={pinned}
            mouseIsOver={mouseIsOver}
            addonBefore={logRowMenuIconsBefore}
            addonAfter={logRowMenuIconsAfter}
            {...rest}
          />
        )}
      </td>
    </>
  );
});

const displayedFieldsStyles = {
  noWrap: css({
    whiteSpace: 'nowrap',
  }),
};

LogRowMessageDisplayedFields.displayName = 'LogRowMessageDisplayedFields';
