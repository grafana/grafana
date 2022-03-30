import React, { PureComponent } from 'react';
import { CollapsableSection, Field, Input, Switch, TimeZonePicker, WeekStartPicker } from '@grafana/ui';
import { rangeUtil, TimeZone } from '@grafana/data';
import { isEmpty } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';

interface Props {
  onWeekStartChange: (weekStart: string) => void;
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onMaxTimeRangeChange: (maxTimeRange: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  onLiveNowChange: (liveNow: boolean) => void;
  refreshIntervals: string[];
  timePickerHidden: boolean;
  nowDelay: string;
  maxTimeRange: string;
  timezone: TimeZone;
  weekStart: string;
  liveNow: boolean;
}

interface State {
  isNowDelayValid: boolean;
  isMaxTimeRangeValid: boolean;
}

export class TimePickerSettings extends PureComponent<Props, State> {
  state: State = { isNowDelayValid: true, isMaxTimeRangeValid: true };

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

  onMaxTimeRangeChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (isEmpty(value)) {
      this.setState({ isMaxTimeRangeValid: true });
      return this.props.onMaxTimeRangeChange(value);
    }

    if (value.match(/^(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])$/)) {
      this.setState({ isMaxTimeRangeValid: true });
      return this.props.onMaxTimeRangeChange(value);
    }

    this.setState({ isMaxTimeRangeValid: false });
  };

  onHideTimePickerChange = () => {
    this.props.onHideTimePickerChange(!this.props.timePickerHidden);
  };

  onLiveNowChange = () => {
    this.props.onLiveNowChange(!this.props.liveNow);
  };

  onTimeZoneChange = (timeZone?: string) => {
    if (typeof timeZone !== 'string') {
      return;
    }
    this.props.onTimeZoneChange(timeZone);
  };

  onWeekStartChange = (weekStart: string) => {
    this.props.onWeekStartChange(weekStart);
  };

  render() {
    return (
      <CollapsableSection label="Time options" isOpen={true}>
        <Field label="Timezone" data-testid={selectors.components.TimeZonePicker.containerV2}>
          <TimeZonePicker
            inputId="time-options-input"
            includeInternal={true}
            value={this.props.timezone}
            onChange={this.onTimeZoneChange}
            width={40}
          />
        </Field>
        <Field label="Week start" data-testid={selectors.components.WeekStartPicker.containerV2}>
          <WeekStartPicker
            inputId="week-start-input"
            width={40}
            value={this.props.weekStart}
            onChange={this.onWeekStartChange}
          />
        </Field>
        <AutoRefreshIntervals
          refreshIntervals={this.props.refreshIntervals}
          onRefreshIntervalChange={this.props.onRefreshIntervalChange}
        />
        <Field label="Now delay" description="Exclude recent data that may be incomplete.">
          <Input
            id="now-delay-input"
            invalid={!this.state.isNowDelayValid}
            placeholder="0m"
            onChange={this.onNowDelayChange}
            defaultValue={this.props.nowDelay}
          />
        </Field>
        <Field
           label="Max time range"
           description="Limits users to the specified time interval."
        >
          <Input
            invalid={!this.state.isMaxTimeRangeValid}
            onChange={this.onMaxTimeRangeChange}
            defaultValue={this.props.maxTimeRange}
          />
        </Field>
        <Field label="Hide time picker">
          <Switch
            id="hide-time-picker-toggle"
            value={!!this.props.timePickerHidden}
            onChange={this.onHideTimePickerChange}
          />
        </Field>
        <Field
          label="Refresh live dashboards"
          description="Continuously re-draw panels where the time range references 'now'"
        >
          <Switch id="refresh-live-dashboards-toggle" value={!!this.props.liveNow} onChange={this.onLiveNowChange} />
        </Field>
      </CollapsableSection>
    );
  }
}
