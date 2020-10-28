import React, { PureComponent } from 'react';
import { Input, LegacyForms, TimeZonePicker, Tooltip } from '@grafana/ui';
import { rangeUtil, TimeZone } from '@grafana/data';
import isEmpty from 'lodash/isEmpty';
import { selectors } from '@grafana/e2e-selectors';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';

export const isValidTimeSpanInput = (value: string): boolean => {
  const timeUnits = ['ms', 's', 'm', 'h', 'd', 'w', 'M', 'y'];
  // this pattern matches a number without leading zeros followed by a time unit and optional trailing whitespace
  const regexp = new RegExp(`^(0|[1-9]\\d*)(${timeUnits.join('|')})\\s*$`);
  return isEmpty(value) || regexp.test(value);
};

interface Props {
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onMaxTimeSpanChange: (maxTimeSpan: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  onTimeRangeStartLimitChange: (timeRangeStartLimit: string) => void;
  renderCount: number; // hack to make sure Angular changes are propagated properly, please remove when DashboardSettings are migrated to React
  refreshIntervals: string[];
  timePickerHidden: boolean;
  nowDelay: string;
  timeRangeStartLimit: string;
  maxTimeSpan: string;
  timezone: TimeZone;
}

interface State {
  isNowDelayValid: boolean;
  isTimeRangeStartLimitValid: boolean;
  isMaxTimeSpanValid: boolean;
}

export class TimePickerSettings extends PureComponent<Props, State> {
  state: State = { isNowDelayValid: true, isTimeRangeStartLimitValid: true, isMaxTimeSpanValid: true };

  onNowDelayChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isEmpty(value)) {
      this.setState({ isNowDelayValid: true });
      return this.props.onNowDelayChange(value);
    }

    if (rangeUtil.isValidTimeSpan(value)) {
      this.setState({ isNowDelayValid: true });
      return this.props.onNowDelayChange(value);
    }

    this.setState({ isNowDelayValid: false });
  };

  onTimeRangeStartLimitChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isValidTimeSpanInput(value)) {
      this.setState({ isTimeRangeStartLimitValid: true });
      this.props.onTimeRangeStartLimitChange(value.trimRight());
    } else {
      this.setState({ isTimeRangeStartLimitValid: false });
    }
  };

  onMaxTimeSpanChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isValidTimeSpanInput(value)) {
      this.setState({ isMaxTimeSpanValid: true });
      this.props.onMaxTimeSpanChange(value.trimRight());
    } else {
      this.setState({ isMaxTimeSpanValid: false });
    }
  };

  onHideTimePickerChange = () => {
    this.props.onHideTimePickerChange(!this.props.timePickerHidden);
  };

  onTimeZoneChange = (timeZone: string) => {
    if (typeof timeZone !== 'string') {
      return;
    }
    this.props.onTimeZoneChange(timeZone);
  };

  render() {
    return (
      <div className="editor-row">
        <h5 className="section-heading">Time Options</h5>
        <div className="gf-form-group">
          <div className="gf-form" aria-label={selectors.components.TimeZonePicker.container}>
            <label className="gf-form-label width-7">Timezone</label>
            <TimeZonePicker
              includeInternal={true}
              value={this.props.timezone}
              onChange={this.onTimeZoneChange}
              width={40}
            />
          </div>
          <AutoRefreshIntervals
            renderCount={this.props.renderCount}
            refreshIntervals={this.props.refreshIntervals}
            onRefreshIntervalChange={this.props.onRefreshIntervalChange}
          />
          <div className="gf-form">
            <span className="gf-form-label width-7">Now delay now-</span>
            <Tooltip
              placement="right"
              content={'Enter 1m to ignore the last minute (because it can contain incomplete metrics)'}
            >
              <Input
                width={60}
                invalid={!this.state.isNowDelayValid}
                placeholder="0m"
                onChange={this.onNowDelayChange}
                defaultValue={this.props.nowDelay}
              />
            </Tooltip>
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-7">Max time back</span>
            <Tooltip placement="right" content={'Enter the maximum time users can go back'}>
              <Input
                width={60}
                invalid={!this.state.isTimeRangeStartLimitValid}
                onChange={this.onTimeRangeStartLimitChange}
                defaultValue={this.props.timeRangeStartLimit}
              />
            </Tooltip>
          </div>
          <div className="gf-form">
            <span className="gf-form-label width-7">Max time span</span>
            <Tooltip placement="right" content={'Enter the maximum time span allowed by time range controls'}>
              <Input
                width={60}
                invalid={!this.state.isMaxTimeSpanValid}
                onChange={this.onMaxTimeSpanChange}
                defaultValue={this.props.maxTimeSpan}
              />
            </Tooltip>
          </div>
          <div className="gf-form">
            <LegacyForms.Switch
              labelClass="width-7"
              label="Hide time picker"
              checked={this.props.timePickerHidden ?? false}
              onChange={this.onHideTimePickerChange}
            />
          </div>
        </div>
      </div>
    );
  }
}
