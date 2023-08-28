import React, { useMemo, useState } from 'react';

import { CoreApp, LogRowModel } from '@grafana/data';

import { LogMessage } from './LogMessage';
import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';
export { MAX_CHARACTERS } from './LogMessage';
interface Props {
  row: LogRowModel;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  app?: CoreApp;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  expandAllLogs?: boolean;
  onBlur: () => void;
}

const restructureLog = (line: string, prettifyLogMessage: boolean): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {
      return line;
    }
  }
  return line;
};

export const LogRowMessage = React.memo((props: Props) => {
  const {
    row,
    wrapLogMessage,
    prettifyLogMessage,
    showContextToggle,
    styles,
    onOpenContext,
    onPermalinkClick,
    onUnpinLine,
    onPinLine,
    pinned,
    mouseIsOver,
    onBlur,
    expandAllLogs,
  } = props;
  const { hasAnsi, raw } = row;
  const restructuredEntry = useMemo(() => restructureLog(raw, prettifyLogMessage), [raw, prettifyLogMessage]);
  const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);
  // there are two levels for expanding logs - for specific row and for all rows. All rows are hanlded via prop(expandAllLogs), while the specific row is handled via state(expandLogMessage) in this component.
  const [expandLogMessage, setExpandLogMessage] = useState(false);
  const shouldBeExapnded = expandLogMessage || (expandAllLogs ?? false);
  return (
    <>
      {
        // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
        // overwrite the more sepecific style definition from `styles.logsRowMessage`.
      }
      <td className={styles.logsRowMessage}>
        <div className={wrapLogMessage ? styles.positionRelative : styles.horizontalScroll}>
          <button className={`${styles.logLine} ${styles.positionRelative}`}>
            <LogMessage
              expandLogMessage={shouldBeExapnded}
              hasAnsi={hasAnsi}
              entry={restructuredEntry}
              highlights={row.searchWords}
              styles={styles}
            />
          </button>
        </div>
      </td>
      <td className={`log-row-menu-cell ${styles.logRowMenuCell}`}>
        {shouldShowMenu && (
          <LogRowMenuCell
            logText={restructuredEntry}
            row={row}
            showContextToggle={showContextToggle}
            onOpenContext={onOpenContext}
            onPermalinkClick={onPermalinkClick}
            onPinLine={onPinLine}
            onUnpinLine={onUnpinLine}
            pinned={pinned}
            styles={styles}
            mouseIsOver={mouseIsOver}
            onBlur={onBlur}
            expandLogMessage={setExpandLogMessage}
            expandAllLogs={!(expandAllLogs ?? true)}
          />
        )}
      </td>
    </>
  );
});

LogRowMessage.displayName = 'LogRowMessage';
