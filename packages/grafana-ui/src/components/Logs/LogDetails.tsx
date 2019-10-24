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
  /* <LogLabels getRows={getRows} labels={row.uniqueLabels ? row.uniqueLabels : {}} onClickLabel={onClickLabel} /> */
  const style = getLogRowStyles(theme, row.logLevel);
  return (
    <div className={cx([style.logsRowDetailsTable])}>
      {Object.keys(row).map((item, idx) => {
        return (
          <div key={idx} className={cx([style.logsRowDetailsRow])}>
            <div onClick={() => alert('1')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-signal'} />
            </div>
            <div onClick={() => alert('2')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-search-plus'} />
            </div>
            <div onClick={() => alert('3')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-search-minus'} />
            </div>
            <div className={cx([style.logsRowDetailsLabel])}>{item}</div>
            <div className={cx([style.logsRowCell])}>{JSON.stringify(row[item])}</div>
          </div>
        );
      })}
    </div>
  );
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
