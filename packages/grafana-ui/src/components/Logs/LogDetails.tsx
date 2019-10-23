import React from 'react';
import { LogRowModel } from '@grafana/data';
import { cx } from 'emotion';
import { LogLabels } from './LogLabels';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickLabel?: (label: string, value: string) => void;
}

function UnThemedLogDetails(props: Props) {
  const { getRows, onClickLabel, row, theme } = props;
  const style = getLogRowStyles(theme, row.logLevel);
  return (
    <div className={cx([style.logsRow])}>
      <div className={cx([style.logsRowLevelDetails])} />
      <div className={cx([style.logsRowLabels])}>
        <LogLabels getRows={getRows} labels={row.uniqueLabels ? row.uniqueLabels : {}} onClickLabel={onClickLabel} />
      </div>
    </div>
  );
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
