import { isEmpty } from 'lodash';
import { PureComponent } from 'react';
import * as React from 'react';

import { rangeUtil, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { CollapsableSection, Field, Input, Switch, TimeZonePicker, WeekStart, WeekStartPicker } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AutoRefreshIntervals } from './AutoRefreshIntervals';

interface Props {
  onWeekStartChange: (weekStart?: WeekStart) => void;
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  onLiveNowChange: (liveNow: boolean) => void;
  refreshIntervals?: string[];
  timePickerHidden?: boolean;
  nowDelay?: string;
  timezone: TimeZone;
  weekStart?: WeekStart;
  liveNow?: boolean;
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

  onWeekStartChange = (weekStart?: WeekStart) => {
    this.props.onWeekStartChange(weekStart);
  };

  render() {
    return (
      <CollapsableSection label={t('dashboard-settings.time-picker.time-options-label', 'Time options')} isOpen={true}>
        <Field
          label={t('dashboard-settings.time-picker.time-zone-label', 'Time zone')}
          data-testid={selectors.components.TimeZonePicker.containerV2}
        >
          <TimeZonePicker
            inputId="time-options-input"
            includeInternal={true}
            value={this.props.timezone}
            onChange={this.onTimeZoneChange}
            width={40}
          />
        </Field>
        <Field
          label={t('dashboard-settings.time-picker.week-start-label', 'Week start')}
          data-testid={selectors.components.WeekStartPicker.containerV2}
        >
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
        <Field
          label={t('dashboard-settings.time-picker.now-delay-label', 'Now delay')}
          description={t(
            'dashboard-settings.time-picker.now-delay-description',
            'Exclude recent data that may be incomplete.'
          )}
        >
          <Input
            id="now-delay-input"
            invalid={!this.state.isNowDelayValid}
            // eslint-disable-next-line @grafana/no-untranslated-strings
            placeholder="0m"
            onChange={this.onNowDelayChange}
            defaultValue={this.props.nowDelay}
          />
        </Field>
        <Field label={t('dashboard-settings.time-picker.hide-time-picker', 'Hide time picker')}>
          <Switch
            id="hide-time-picker-toggle"
            value={!!this.props.timePickerHidden}
            onChange={this.onHideTimePickerChange}
          />
        </Field>
        <Field
          label={t('dashboard-settings.time-picker.refresh-live-dashboards-label', 'Refresh live dashboards')}
          description={t(
            'dashboard-settings.time-picker.refresh-live-dashboards-description',
            "Continuously re-draw panels where the time range references 'now'"
          )}
        >
          <Switch id="refresh-live-dashboards-toggle" value={!!this.props.liveNow} onChange={this.onLiveNowChange} />
        </Field>
      </CollapsableSection>
    );
  }
}
