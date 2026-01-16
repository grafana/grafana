import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomCellRendererProps, useStyles2 } from '@grafana/ui';

import { LogsFrame } from '../../../features/logs/logsFrame';

import { LogsNGTableRowActionButtons } from './LogsNGTableRowActionButtons';
import { ROW_ACTION_BUTTON_WIDTH } from './LogsTable';
import { BuildLinkToLogLine } from './types';

export function LogsTableCustomCellRenderer(props: {
  cellProps: CustomCellRendererProps;
  logsFrame: LogsFrame;
  buildLinkToLog?: BuildLinkToLogLine;
}) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <LogsNGTableRowActionButtons
        {...props.cellProps}
        buildLinkToLog={props.buildLinkToLog ?? buildLinkToLog}
        logsFrame={props.logsFrame}
      />
      <span className={styles.firstColumnCell}>
        {props.cellProps.field.display?.(props.cellProps.value).text ?? String(props.cellProps.value)}
      </span>
    </>
  );
}

const buildLinkToLog: BuildLinkToLogLine = (logsFrame, rowIndex, field) => {
  return '@todo';
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    firstColumnCell: css({
      paddingLeft: ROW_ACTION_BUTTON_WIDTH,
    }),
  };
};
