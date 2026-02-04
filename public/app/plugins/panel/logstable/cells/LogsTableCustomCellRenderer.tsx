import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomCellRendererProps, useStyles2 } from '@grafana/ui';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { ROW_ACTION_BUTTON_WIDTH } from '../constants';
import { LogsTableRowActionButtons } from '../rows/LogsTableRowActionButtons';
import { BuildLinkToLogLine } from '../types';

export function LogsTableCustomCellRenderer(props: {
  cellProps: CustomCellRendererProps;
  buildLinkToLog?: BuildLinkToLogLine;
  logsFrame: LogsFrame;
  supportsPermalink: boolean;
  showCopyLogLink: boolean;
  showInspectLogLine: boolean;
}) {
  const { logsFrame, buildLinkToLog, supportsPermalink, showCopyLogLink, showInspectLogLine } = props;
  const cellPadding =
    showInspectLogLine && showCopyLogLink
      ? ROW_ACTION_BUTTON_WIDTH
      : showInspectLogLine || showCopyLogLink
        ? ROW_ACTION_BUTTON_WIDTH / 2
        : 0;
  const styles = useStyles2(getStyles, cellPadding);

  return (
    <>
      <LogsTableRowActionButtons
        {...props.cellProps}
        logsFrame={logsFrame}
        buildLinkToLog={supportsPermalink && showCopyLogLink ? buildLinkToLog : undefined}
        showInspectLogLine={showInspectLogLine ?? true}
      />
      <span className={styles.firstColumnCell}>
        {props.cellProps.field.display?.(props.cellProps.value).text ?? String(props.cellProps.value)}
      </span>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2, cellPadding: number) => {
  return {
    firstColumnCell: css({
      paddingLeft: cellPadding,
    }),
  };
};
