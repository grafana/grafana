import React from 'react';
import { LogRowModel } from '@grafana/data';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

function UnThemedLogDetails(props: Props) {
  const { row, theme, onClickFilterLabel, onClickFilterOutLabel } = props;
  // const { getRows, onClickLabel } = props;
  /* <LogLabels getRows={getRows} labels={row.uniqueLabels ? row.uniqueLabels : {}} onClickLabel={onClickLabel} /> */

  const filterLabel = (label: string, value: string) => {
    if (onClickFilterLabel) {
      onClickFilterLabel(label, value);
    }
  };

  const filterOutLabel = (label: string, value: string) => {
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(label, value);
    }
  };
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
            <div onClick={() => filterLabel(key, labels[key])} className={cx([style.logsRowDetailsIcon])}>
              <i className={'fa fa-search-plus'} />
            </div>
            <div onClick={() => filterOutLabel(key, labels[key])} className={cx([style.logsRowDetailsIcon])}>
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
