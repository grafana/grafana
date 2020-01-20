import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { SelectableValue } from '@grafana/data';
import { css } from 'emotion';
import { Tooltip } from '../Tooltip/Tooltip';
import { ButtonSelect } from '../Select/ButtonSelect';
import memoizeOne from 'memoize-one';
import { GrafanaTheme } from '@grafana/data';
import { withTheme } from '../../themes';

export const defaultIntervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];

const getStyles = memoizeOne((theme: GrafanaTheme) => {
  return {
    selectButton: css`
      label: selectButton;
      .select-button-value {
        color: ${theme.colors.orange};
      }
    `,
  };
});

export interface Props {
  intervals?: string[];
  onRefresh?: () => any;
  onIntervalChanged: (interval: string) => void;
  value?: string;
  tooltip?: string;
  hasLiveOption?: boolean;
  // You can supply your own refresh button element. In that case onRefresh and tooltip are ignored.
  refreshButton?: React.ReactNode;
  buttonSelectClassName?: string;
  theme: GrafanaTheme;
}

export class RefreshPickerBase extends PureComponent<Props> {
  static offOption = { label: 'Off', value: '' };
  static liveOption = { label: 'Live', value: 'LIVE' };
  static isLive = (refreshInterval?: string): boolean => refreshInterval === RefreshPicker.liveOption.value;

  constructor(props: Props) {
    super(props);
  }

  intervalsToOptions = (intervals: string[] | undefined): Array<SelectableValue<string>> => {
    const intervalsOrDefault = intervals || defaultIntervals;
    const options = intervalsOrDefault.map(interval => ({ label: interval, value: interval }));

    if (this.props.hasLiveOption) {
      options.unshift(RefreshPicker.liveOption);
    }

    options.unshift(RefreshPicker.offOption);
    return options;
  };

  onChangeSelect = (item: SelectableValue<string>) => {
    const { onIntervalChanged } = this.props;
    if (onIntervalChanged) {
      // @ts-ignore
      onIntervalChanged(item.value);
    }
  };

  render() {
    const { onRefresh, intervals, tooltip, value, refreshButton, buttonSelectClassName, theme } = this.props;
    const options = this.intervalsToOptions(intervals);
    const currentValue = value || '';
    const selectedValue = options.find(item => item.value === currentValue) || RefreshPicker.offOption;
    const styles = getStyles(theme);

    const cssClasses = classNames({
      'refresh-picker': true,
      'refresh-picker--off': selectedValue.label === RefreshPicker.offOption.label,
      'refresh-picker--live': selectedValue === RefreshPicker.liveOption,
    });

    return (
      <div className={cssClasses}>
        <div className="refresh-picker-buttons">
          {refreshButton ? (
            refreshButton
          ) : (
            <Tooltip placement="top" content={tooltip!}>
              <button
                className="btn btn--radius-right-0 navbar-button navbar-button--border-right-0"
                onClick={onRefresh!}
              >
                <i className="fa fa-refresh" />
              </button>
            </Tooltip>
          )}
          <ButtonSelect
            className={classNames('navbar-button--attached', styles.selectButton, buttonSelectClassName)}
            value={selectedValue}
            label={selectedValue.label}
            options={options}
            onChange={this.onChangeSelect}
            maxMenuHeight={380}
          />
        </div>
      </div>
    );
  }
}

export const RefreshPicker = withTheme<
  Props,
  {
    offOption: typeof RefreshPickerBase.offOption;
    liveOption: typeof RefreshPickerBase.liveOption;
    isLive: typeof RefreshPickerBase.isLive;
  }
>(RefreshPickerBase);
