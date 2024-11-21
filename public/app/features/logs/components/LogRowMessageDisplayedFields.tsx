import { css } from '@emotion/css';
import { memo, ReactNode, useMemo } from 'react';

import { LogRowModel, Field, LinkModel, DataFrame } from '@grafana/data';

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
    ...rest
  } = props;
  const wrapClassName = wrapLogMessage ? '' : displayedFieldsStyles.noWrap;
  const fields = useMemo(() => getAllFields(row, getFieldLinks), [getFieldLinks, row]);
  // only single key/value rows are filterable, so we only need the first field key for filtering
  const line = useMemo(() => {
    let line = '';
    for (let i = 0; i < detectedFields.length; i++) {
      const parsedKey = detectedFields[i];
      const field = fields.find((field) => {
        const { keys } = field;
        return keys[0] === parsedKey;
      });

      if (field) {
        line += ` ${parsedKey}=${field.values}`;
      }

      if (row.labels[parsedKey] !== undefined && row.labels[parsedKey] !== null) {
        line += ` ${parsedKey}=${row.labels[parsedKey]}`;
      }
    }
    return line.trimStart();
  }, [detectedFields, fields, row.labels]);

  const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);

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
