import { isEmpty } from 'lodash';
import { FormEvent, memo, useState } from 'react';

import { rangeUtil, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import {
  CollapsableSection,
  Field,
  Input,
  Stack,
  Switch,
  TimeZonePicker,
  WeekStart,
  WeekStartPicker,
} from '@grafana/ui';

import { AutoRefreshIntervals } from './AutoRefreshIntervals';

interface Props {
  onWeekStartChange: (weekStart?: WeekStart) => void;
  onTimeZoneChange: (timeZone: TimeZone) => void;
  onRefreshIntervalChange: (interval: string[]) => void;
  onNowDelayChange: (nowDelay: string) => void;
  onHideTimePickerChange: (hide: boolean) => void;
  onLiveNowChange: (liveNow: boolean) => void;
  onConnectLiveToAutoRefreshChange?: (connectLiveToAutoRefresh: boolean) => void;
  refreshIntervals?: string[];
  timePickerHidden?: boolean;
  nowDelay?: string;
  timezone: TimeZone;
  weekStart?: WeekStart;
  liveNow?: boolean;
  connectLiveToAutoRefresh?: boolean;
}

export const TimePickerSettings = memo(
  ({
    onWeekStartChange,
    onTimeZoneChange,
    onRefreshIntervalChange,
    onNowDelayChange,
    onHideTimePickerChange,
    onLiveNowChange,
    onConnectLiveToAutoRefreshChange,
    refreshIntervals,
    timePickerHidden,
    nowDelay,
    timezone,
    weekStart,
    liveNow,
    connectLiveToAutoRefresh,
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

    const handleConnectLiveToAutoRefreshChange = () => {
      onConnectLiveToAutoRefreshChange?.(!connectLiveToAutoRefresh);
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
        <Stack direction="column" gap={2}>
          <Field
            label={t('dashboard-settings.time-picker.time-zone-label', 'Time zone')}
            data-testid={selectors.components.TimeZonePicker.containerV2}
            noMargin
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
            noMargin
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
            noMargin
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
          <Field label={t('dashboard-settings.time-picker.hide-time-picker', 'Hide time picker')} noMargin>
            <Switch id="hide-time-picker-toggle" value={!!timePickerHidden} onChange={handleHideTimePickerChange} />
          </Field>
          <Field
            label={t('dashboard-settings.time-picker.refresh-live-dashboards-label', 'Refresh live dashboards')}
            description={t(
              'dashboard-settings.time-picker.refresh-live-dashboards-description',
              'Continuously update panels when the time range includes the current time'
            )}
            noMargin
          >
            <Switch id="refresh-live-dashboards-toggle" value={!!liveNow} onChange={handleLiveNowChange} />
          </Field>
          <Field
            label={t(
              'dashboard-settings.time-picker.connect-live-to-auto-refresh-label',
              'Connect live panels to auto refresh'
            )}
            description={t(
              'dashboard-settings.time-picker.connect-live-to-auto-refresh-description',
              'When enabled, live panels will not stream data if auto refresh is set to Off'
            )}
            noMargin
          >
            <Switch
              id="connect-live-to-auto-refresh-toggle"
              value={!!connectLiveToAutoRefresh}
              onChange={handleConnectLiveToAutoRefreshChange}
            />
          </Field>
        </Stack>
      </CollapsableSection>
    );
  }
);
TimePickerSettings.displayName = 'TimePickerSettings';
