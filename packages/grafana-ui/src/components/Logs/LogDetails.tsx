import React from 'react';
import { LogRowModel } from '@grafana/data';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickLabel?: (label: string, value: string) => void;
}

function UnThemedLogDetails(props: Props) {
  const { row, theme } = props;
  // const { getRows, onClickLabel } = props;
  const style = getLogRowStyles(theme, row.logLevel);
  return (
    <div className={cx([style.logsRowDetailsTable])}>
      <tr>
        <td>A</td>
        <td>B</td>
        <td>C</td>
      </tr>
      <tr>
        <td>A</td>
        <td>B</td>
        <td>C</td>
      </tr>
      <tr>
        <td>A</td>
        <td>B</td>
        <td>C</td>
      </tr>
      {/* <LogLabels getRows={getRows} labels={row.uniqueLabels ? row.uniqueLabels : {}} onClickLabel={onClickLabel} /> */}
    </div>
  );
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
