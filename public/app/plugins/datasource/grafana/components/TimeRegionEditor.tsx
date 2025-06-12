import { css } from '@emotion/css';
import moment, { Moment } from 'moment/moment';
import { ChangeEvent, useState } from 'react';

import { dateTimeAsMoment, getTimeZoneInfo, GrafanaTheme2, isDateTime, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Button,
  Field,
  FieldSet,
  Input,
  Select,
  Stack,
  Switch,
  TimeOfDayPicker,
  TimeZonePicker,
  useStyles2,
} from '@grafana/ui';
import { TimeZoneOffset, TimeZoneTitle } from '@grafana/ui/internal';
import { TimeRegionConfig, TimeRegionMode } from 'app/core/utils/timeRegions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

interface Props {
  value: TimeRegionConfig;
  onChange: (value?: TimeRegionConfig) => void;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((v, idx) => {
  return {
    label: v,
    value: idx + 1,
  };
});

export const TimeRegionEditor = ({ value, onChange }: Props) => {
  const styles = useStyles2(getStyles);

  const timestamp = Date.now();
  const timezoneInfo = getTimeZoneInfo(value.timezone ?? 'utc', timestamp);
  const isDashboardTimezone = getDashboardSrv().getCurrent()?.getTimezone() === value.timezone;

  const [isEditing, setEditing] = useState(false);

  const onToggleChangeTimezone = () => {
    setEditing(!isEditing);
  };

  const getTime = (time: string | undefined): Moment | undefined => {
    if (!time) {
      return undefined;
    }

    const date = moment();

    if (time) {
      const match = time.split(':');
      date.set('hour', parseInt(match[0], 10));
      date.set('minute', parseInt(match[1], 10));
    }

    return date;
  };

  const getToPlaceholder = () => {
    let placeholder = 'Everyday';
    if (value.fromDayOfWeek && !value.toDayOfWeek) {
      placeholder = days[value.fromDayOfWeek - 1].label;
    }

    return placeholder;
  };

  const renderTimezonePicker = () => {
    const timezone = (
      <>
        <TimeZoneTitle title={timezoneInfo?.name} />
        <TimeZoneOffset timeZone={value.timezone} timestamp={timestamp} />
      </>
    );

    if (isDashboardTimezone) {
      return <>Dashboard timezone ({timezone})</>;
    }

    return timezone;
  };

  const onTimeChange = (v: Moment | undefined, field: string) => {
    const time = v ? v.format('HH:mm') : undefined;
    if (field === 'from') {
      onChange({ ...value, from: time });
    } else {
      onChange({ ...value, to: time });
    }
  };

  const onTimezoneChange = (v: string | undefined) => {
    onChange({ ...value, timezone: v });
  };

  const onModeChange = (v: TimeRegionMode) => {
    onChange({ ...value, mode: v });
  };

  const onCronExprChange = (v: string) => {
    onChange({ ...value, cronExpr: v });
  };

  const onDurationChange = (v: string) => {
    onChange({ ...value, duration: v });
  };

  const onFromDayOfWeekChange = (v: SelectableValue<number>) => {
    const fromDayOfWeek = v ? v.value : undefined;
    const toDayOfWeek = v ? value.toDayOfWeek : undefined; // clear if everyday
    onChange({ ...value, fromDayOfWeek, toDayOfWeek });
  };

  const onToDayOfWeekChange = (v: SelectableValue<number>) => {
    onChange({ ...value, toDayOfWeek: v ? v.value : undefined });
  };

  const renderTimezone = () => {
    if (isEditing) {
      return (
        <TimeZonePicker
          value={value.timezone}
          includeInternal={true}
          onChange={(v) => onTimezoneChange(v)}
          onBlur={() => setEditing(false)}
          openMenuOnFocus={false}
          width={100}
          autoFocus
        />
      );
    }

    return (
      <div className={styles.timezoneContainer}>
        <div className={styles.timezone}>{renderTimezonePicker()}</div>
        <Button variant="secondary" onClick={onToggleChangeTimezone} size="sm">
          Change timezone
        </Button>
      </div>
    );
  };

  const from = getTime(value.from);
  const to = getTime(value.to);

  return (
    <FieldSet className={styles.wrapper}>
      <Field
        label={t('dashboard-settings.time-regions.advanced-label', 'Advanced')}
        description={
          <>
            {t('dashboard-settings.time-regions.advanced-description-use', 'Use ')}
            <a href="https://crontab.run/" target="_blank">
              {t('dashboard-settings.time-regions.advanced-description-cron', 'Cron syntax')}
            </a>
            {t(
              'dashboard-settings.time-regions.advanced-description-rest',
              ' to define a recurrence schedule and duration'
            )}
          </>
        }
      >
        <Switch
          id="time-regions-adanced-mode-toggle"
          value={value.mode === 'cron'}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onModeChange(e.currentTarget.checked ? 'cron' : null)}
        />
      </Field>

      {value.mode == null && (
        <>
          <Field label="From">
            <Stack gap={0.5}>
              <Select
                options={days}
                isClearable
                placeholder="Everyday"
                value={value.fromDayOfWeek ?? null}
                onChange={(v) => onFromDayOfWeekChange(v)}
                width={20}
              />
              <TimeOfDayPicker
                value={isDateTime(from) ? from : undefined}
                onChange={(v) => onTimeChange(v ? dateTimeAsMoment(v) : v, 'from')}
                allowEmpty={true}
                placeholder="HH:mm"
                size="sm"
              />
            </Stack>
          </Field>
          <Field label="To">
            <Stack gap={0.5}>
              {(value.fromDayOfWeek || value.toDayOfWeek) && (
                <Select
                  options={days}
                  isClearable
                  placeholder={getToPlaceholder()}
                  value={value.toDayOfWeek ?? null}
                  onChange={(v) => onToDayOfWeekChange(v)}
                  width={20}
                />
              )}
              <TimeOfDayPicker
                value={isDateTime(to) ? to : undefined}
                onChange={(v) => onTimeChange(v ? dateTimeAsMoment(v) : v, 'to')}
                allowEmpty={true}
                placeholder="HH:mm"
                size="sm"
              />
            </Stack>
          </Field>
        </>
      )}
      {value.mode === 'cron' && (
        <>
          <Field label="Cron expression">
            <Input
              onChange={(e: ChangeEvent<HTMLInputElement>) => onCronExprChange(e.target.value)}
              value={value.cronExpr}
              placeholder="0 9 * * 1-5"
              width={40}
            />
          </Field>
          <Field label="Duration">
            <Input
              onChange={(e: ChangeEvent<HTMLInputElement>) => onDurationChange(e.target.value)}
              value={value.duration}
              placeholder="8h"
              width={40}
            />
          </Field>
        </>
      )}
      <Field label="Timezone">{renderTimezone()}</Field>
    </FieldSet>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      maxWidth: theme.spacing(60),
      marginBottom: theme.spacing(2),
    }),
    timezoneContainer: css({
      padding: '5px',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px',
    }),
    timezone: css({
      marginRight: '5px',
    }),
  };
};
