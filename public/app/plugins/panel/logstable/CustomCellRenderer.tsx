import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomCellRendererProps, useStyles2 } from '@grafana/ui';

import { LogsNGTableRowActionButtons } from './LogsNGTableRowActionButtons';
import { ROW_ACTION_BUTTON_WIDTH } from './LogsTable';
import { BuildLinkToLogLine } from './types';

export function LogsTableCustomCellRenderer(props: {
  cellProps: CustomCellRendererProps;
  bodyFieldName: string;
  buildLinkToLog?: BuildLinkToLogLine;
}) {
  const styles = useStyles2(getStyles);
  const { bodyFieldName } = props;
  return (
    <>
      <LogsNGTableRowActionButtons
        {...props.cellProps}
        bodyFieldName={bodyFieldName}
        buildLinkToLog={props.buildLinkToLog ?? buildLinkToLog}
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
