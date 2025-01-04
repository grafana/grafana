import { cx } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';

import { LogRow, Props as LogRowProps } from './LogRow';
import { createLogRow } from './__mocks__/logRow';

const row = createLogRow();
const fn = () => {};

type Props = Omit<LogRowProps, 'getRows' | 'row' | 'onRowClick' | 'style' | 'onOpenContext' | 'showDetails'> & {
  overflowingContent?: boolean;
  onCalculate(rowHeight: number, logWidth: number): void;
};

export const LogRowDimensions = (props: Props) => {
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  const getRowDimensions = useCallback(() => {
    if (!tbodyRef.current) {
      return;
    }
    const row = tbodyRef.current.querySelector('tr');
    let rowHeight = 0;
    if (row) {
      rowHeight = row.getBoundingClientRect().height;
    }
    const columns = row?.querySelectorAll('td');
    let logWidth = 0;
    if (columns) {
      let width = tbodyRef.current.getBoundingClientRect().width;
      for (let i = 0; i < columns.length - 2; i++) {
        width -= columns[i].getBoundingClientRect().width;
      }
      logWidth = width;
    }
    props.onCalculate(rowHeight, logWidth);
  }, [props]);

  useEffect(() => {
    getRowDimensions();
  }, [props.showDuplicates, props.showTime, props.showLabels, props.wrapLogMessage, getRowDimensions]);

  return (
    <table
      className={cx(
        props.styles.logsRowsTable,
        props.overflowingContent ? '' : props.styles.logsRowsTableContain,
        props.styles.logDimensionsTable
      )}
    >
      <tbody ref={tbodyRef}>
        <LogRow
          getRows={() => [row]}
          row={row}
          showDuplicates={props.showDuplicates}
          logsSortOrder={props.logsSortOrder}
          onOpenContext={fn}
          styles={props.styles}
          pinned={false}
          showDetails={false}
          showLabels={props.showLabels}
          showTime={props.showTime}
          wrapLogMessage={props.wrapLogMessage}
          prettifyLogMessage={props.prettifyLogMessage}
          timeZone={props.timeZone}
          enableLogDetails={props.enableLogDetails}
          onRowClick={fn}
          style={{}}
        />
      </tbody>
    </table>
  );
};
