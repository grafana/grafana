import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomCellRendererProps, useStyles2 } from '@grafana/ui';
import { LogsFrame } from 'app/features/logs/logsFrame';

import { ROW_ACTION_BUTTON_WIDTH } from '../constants';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { LogsTableRowActionButtons } from '../rows/LogsTableRowActionButtons';
import { BuildLinkToLogLine } from '../types';

export function LogsTableCustomCellRenderer(props: {
  cellProps: CustomCellRendererProps;
  buildLinkToLog?: BuildLinkToLogLine;
  options: LogsTableOptions;
  logsFrame: LogsFrame;
  supportsPermalink: boolean;
}) {
  const { logsFrame, buildLinkToLog, options, supportsPermalink } = props;
  const cellPadding =
    options.showInspectLogLine && options.showCopyLogLink
      ? ROW_ACTION_BUTTON_WIDTH
      : options.showInspectLogLine || options.showCopyLogLink
        ? ROW_ACTION_BUTTON_WIDTH / 2
        : 0;
  const styles = useStyles2(getStyles, cellPadding);

  return (
    <>
      <LogsTableRowActionButtons
        {...props.cellProps}
        logsFrame={logsFrame}
        buildLinkToLog={supportsPermalink && options.showCopyLogLink ? buildLinkToLog : undefined}
        showInspectLogLine={options.showInspectLogLine ?? true}
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
