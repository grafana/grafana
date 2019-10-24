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
  const labels = row.labels;
  return (
    <div className={cx([style.logsRowDetailsTable])}>
      {Object.keys(labels).map(key => {
        return (
          <div key={key} className={cx([style.logsRowDetailsRow])}>
            <div onClick={() => alert('1')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-signal'} />
            </div>
            <div onClick={() => alert('2')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-search-plus'} />
            </div>
            <div onClick={() => alert('3')} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-search-minus'} />
            </div>
            <div className={cx([style.logsRowDetailsLabel])}>{key}</div>
            <div className={cx([style.logsRowCell])}>{labels[key]}</div>
          </div>
        );
      })}
    </div>
  );
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
