import React, { PureComponent } from 'react';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

interface Props extends Themeable {
  value: string;
  keyDetail: string;
  canShowMetrics: boolean;
  canFilter: boolean;
  canFilterOut: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

interface State {}

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {};

  filterLabel = () => {
    const { onClickFilterLabel, keyDetail, value } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(keyDetail, value);
    }
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, keyDetail, value } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(keyDetail, value);
    }
  };

  render() {
    const { theme, keyDetail, value, canShowMetrics, canFilter, canFilterOut } = this.props;
    console.log(keyDetail);
    console.log('props', this.props);
    const style = getLogRowStyles(theme);
    return (
      <div key={keyDetail} className={cx([style.logsRowDetailsRow])}>
        {canShowMetrics ? (
          <div onClick={() => alert('metrics')} className={cx([style.logsRowDetailsIcon])}>
            <i className={'fa fa-signal'} />
          </div>
        ) : (
          <div className={cx([style.logsRowDetailsIcon])} />
        )}
        {canFilter ? (
          <div onClick={() => this.filterLabel()} className={cx([style.logsRowDetailsIcon])}>
            <i className={'fa fa-search-plus'} />
          </div>
        ) : (
          <div className={cx([style.logsRowDetailsIcon])} />
        )}
        {canFilterOut ? (
          <div onClick={() => this.filterOutLabel()} className={cx([style.logsRowDetailsIcon])}>
            <i className={'fa fa-search-minus'} />
          </div>
        ) : (
          <div className={cx([style.logsRowDetailsIcon])} />
        )}
        <div className={cx([style.logsRowDetailsLabel])}>{keyDetail}</div>
        <div className={cx([style.logsRowCell])}>{value}</div>
      </div>
    );
  }
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
