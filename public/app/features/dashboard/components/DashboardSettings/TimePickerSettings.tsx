import { isEmpty } from 'lodash';
import { type FormEvent, type ReactNode, memo, useState } from 'react';

import { rangeUtil, type TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { CollapsableSection, Field, Input, Switch, TimeZonePicker, type WeekStart, WeekStartPicker } from '@grafana/ui';

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
  liveNowWarning?: ReactNode;
}

export const TimePickerSettings = memo(
  ({
    onWeekStartChange,
    onTimeZoneChange,
    onRefreshIntervalChange,
    onNowDelayChange,
    onHideTimePickerChange,
    onLiveNowChange,
    refreshIntervals,
    timePickerHidden,
    nowDelay,
    timezone,
    weekStart,
    liveNow,
    liveNowWarning,
  }: Props) => {
    const [isNowDelayValid, setIsNowDelayValid] = useState(true);

    const handleNowDelayChange = (event: FormEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;

      if (isEmpty(value)) {
        setIsNowDelayValid(true);
        return onNowDelayChange(value);
      }

      if (rangeUtil.isValidTimeSpan(value)) {
        setIsNowDelayValid(true);
        return onNowDelayChange(value);
      }

      setIsNowDelayValid(false);
    };

    const handleHideTimePickerChange = () => {
      onHideTimePickerChange(!timePickerHidden);
    };

    const handleLiveNowChange = () => {
      onLiveNowChange(!liveNow);
    };

    const handleTimeZoneChange = (timeZone?: string) => {
      if (typeof timeZone !== 'string') {
        return;
      }
      onTimeZoneChange(timeZone);
    };

    const handleWeekStartChange = (weekStart?: WeekStart) => {
      onWeekStartChange(weekStart);
    };

    return (
      <CollapsableSection label={t('dashboard-settings.time-picker.time-options-label', 'Time options')} isOpen={true}>
        <Field
          label={t('dashboard-settings.time-picker.time-zone-label', 'Time zone')}
          data-testid={selectors.components.TimeZonePicker.containerV2}
        >
          <TimeZonePicker
            inputId="time-options-input"
            includeInternal={true}
            value={timezone}
            onChange={handleTimeZoneChange}
            width={40}
          />
        </Field>
        <Field
          label={t('dashboard-settings.time-picker.week-start-label', 'Week start')}
          data-testid={selectors.components.WeekStartPicker.containerV2}
        >
          <WeekStartPicker inputId="week-start-input" width={40} value={weekStart} onChange={handleWeekStartChange} />
        </Field>
        <AutoRefreshIntervals refreshIntervals={refreshIntervals} onRefreshIntervalChange={onRefreshIntervalChange} />
        <Field
          label={t('dashboard-settings.time-picker.now-delay-label', 'Now delay')}
          description={t(
            'dashboard-settings.time-picker.now-delay-description',
            'Exclude recent data that may be incomplete.'
          )}
        >
          <Input
            id="now-delay-input"
            invalid={!isNowDelayValid}
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="0m"
            onChange={handleNowDelayChange}
            defaultValue={nowDelay}
          />
        </Field>
        <Field label={t('dashboard-settings.time-picker.hide-time-picker', 'Hide time picker')}>
          <Switch id="hide-time-picker-toggle" value={!!timePickerHidden} onChange={handleHideTimePickerChange} />
        </Field>
        <Field
          label={t('dashboard-settings.time-picker.smooth-streaming-label', 'Smooth streaming visualization')}
          description={t(
            'dashboard-settings.time-picker.smooth-streaming-description',
            'Redraws panels at a high rate so streaming data and time-relative axes update smoothly. This is a rendering setting, not a query refresh — it does not fetch new data.'
          )}
        >
          <Switch id="smooth-streaming-toggle" value={!!liveNow} onChange={handleLiveNowChange} />
        </Field>
        {liveNowWarning}
      </CollapsableSection>
    );
  }
);
TimePickerSettings.displayName = 'TimePickerSettings';
