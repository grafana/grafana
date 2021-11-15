import React, { PureComponent } from 'react';
import { Input, TimeZonePicker, Field, Switch, CollapsableSection, WeekStartPicker } from '@grafana/ui';
import { rangeUtil, TimeZone } from '@grafana/data';
import { isEmpty } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { AutoRefreshIntervals } from './AutoRefreshIntervals';

interface Props {
  onWeekStartChange: (weekStart: string) => void;
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  onLiveNowChange: (liveNow: boolean) => void;
  refreshIntervals: string[];
  timePickerHidden: boolean;
  nowDelay: string;
  timezone: TimeZone;
  weekStart: string;
  liveNow: boolean;
}

interface State {
  isNowDelayValid: boolean;
}

export class TimePickerSettings extends PureComponent<Props, State> {
  state: State = { isNowDelayValid: true };

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
        <Field label="Timezone" aria-label={selectors.components.TimeZonePicker.container}>
          <TimeZonePicker
            includeInternal={true}
            value={this.props.timezone}
            onChange={this.onTimeZoneChange}
            width={40}
          />
        </Field>
        <Field label="Week start" aria-label={selectors.components.WeekStartPicker.container}>
          <WeekStartPicker width={40} value={this.props.weekStart} onChange={this.onWeekStartChange} />
        </Field>
        <AutoRefreshIntervals
          refreshIntervals={this.props.refreshIntervals}
          onRefreshIntervalChange={this.props.onRefreshIntervalChange}
        />
        <Field
          label="Now delay now"
          description="Enter 1m to ignore the last minute. It might contain incomplete metrics."
        >
          <Input
            id="now-delay-input"
            invalid={!this.state.isNowDelayValid}
            placeholder="0m"
            onChange={this.onNowDelayChange}
            defaultValue={this.props.nowDelay}
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
