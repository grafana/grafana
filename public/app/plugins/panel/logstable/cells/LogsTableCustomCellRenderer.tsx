import { css } from '@emotion/css';

import { type Field } from '@grafana/data/dataframe';
import { getDisplayProcessor } from '@grafana/data/field';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { formattedValueToString } from '@grafana/data/valueFormats';
import type { CustomCellRendererProps } from '@grafana/ui';
import { MaybeWrapWithLink } from '@grafana/ui/internal';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';
import { type LogsFrame } from 'app/features/logs/logsFrame';

import { ROW_ACTION_BUTTON_WIDTH } from '../constants';
import type { Options as LogsTableOptions } from '../panelcfg.gen';
import { LogsTableRowActionButtons } from '../rows/LogsTableRowActionButtons';
import { type BuildLinkToLogLine } from '../types';

export function LogsTableCustomCellRenderer(props: {
  cellProps: CustomCellRendererProps;
  buildLinkToLog?: BuildLinkToLogLine;
  options: LogsTableOptions;
  logsFrame: LogsFrame;
  supportsPermalink: boolean;
}) {
  const { logsFrame, buildLinkToLog, options, supportsPermalink } = props;
  const { field, value, rowIndex } = props.cellProps;
  const cellPadding =
    options.enableLogDetails && options.showCopyLogLink
      ? ROW_ACTION_BUTTON_WIDTH
      : options.enableLogDetails || options.showCopyLogLink
        ? ROW_ACTION_BUTTON_WIDTH / 2
        : 0;
  const styles = useStyles2(getStyles, cellPadding);

  return (
    <>
      <LogsTableRowActionButtons
        {...props.cellProps}
        logsFrame={logsFrame}
        buildLinkToLog={supportsPermalink && options.showCopyLogLink ? buildLinkToLog : undefined}
      />

      <span className={styles.firstColumnCell}>
        <AutoCell field={field} value={field.display?.(value).text ?? String(value)} rowIdx={rowIndex} />
      </span>
    </>
  );
}

export interface AutoCellProps {
  field: Field;
  value: string;
  rowIdx: number;
}

// Copy pasta from packages/grafana-ui/src/components/Table/TableNG/Cells/AutoCell.tsx
function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const theme = useTheme2();
  const display =
    field.display ??
    getDisplayProcessor({
      field,
      theme,
    });

  const displayValue = display(value);

  const formattedValue = formattedValueToString(displayValue);
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {formattedValue}
    </MaybeWrapWithLink>
  );
}

const getStyles = (theme: GrafanaTheme2, cellPadding: number) => {
  return {
    firstColumnCell: css({
      paddingLeft: cellPadding,
    }),
  };
};
