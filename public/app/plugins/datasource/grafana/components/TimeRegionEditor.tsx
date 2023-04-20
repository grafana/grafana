import { css } from '@emotion/css';
import moment, { Moment } from 'moment/moment';
import React, { useState } from 'react';

import { getTimeZoneInfo, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, FieldSet, HorizontalGroup, Select, TimeZonePicker, useStyles2 } from '@grafana/ui';
import { TimeZoneOffset } from '@grafana/ui/src/components/DateTimePickers/TimeZonePicker/TimeZoneOffset';
import { TimeZoneTitle } from '@grafana/ui/src/components/DateTimePickers/TimeZonePicker/TimeZoneTitle';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { TimeRegionConfig } from '../types';

import { TimePickerInput } from './TimePickerInput';

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
  const timezoneInfo = getTimeZoneInfo(value.timezone!, timestamp);
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

  const renderTimezone = () => {
    if (isEditing) {
      return (
        <TimeZonePicker
          value={value.timezone}
          includeInternal={true}
          onChange={(v) => onChange({ ...value, timezone: v })}
          onBlur={() => setEditing(false)}
          menuShouldPortal={true}
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

  return (
    <FieldSet className={styles.wrapper}>
      <Field label="From">
        <HorizontalGroup spacing="xs">
          <Select
            options={days}
            isClearable
            placeholder="Everyday"
            value={value.fromDayOfWeek ?? null}
            onChange={(v) => {
              const fromDayOfWeek = v ? v.value : undefined;
              const toDayOfWeek = v ? value.toDayOfWeek : undefined; // clear if everyday
              onChange({ ...value, fromDayOfWeek, toDayOfWeek });
            }}
            width={20}
          />
          <TimePickerInput
            value={getTime(value.from)}
            onChange={(v) => onChange({ ...value, from: v ? v.format('HH:mm') : undefined })}
            allowEmpty={true}
            placeholder="HH:mm"
            width={100}
          />
        </HorizontalGroup>
      </Field>
      <Field label="To">
        <HorizontalGroup spacing="xs">
          {(value.fromDayOfWeek || value.toDayOfWeek) && (
            <Select
              options={days}
              isClearable
              placeholder={getToPlaceholder()}
              value={value.toDayOfWeek ?? null}
              onChange={(v) => onChange({ ...value, toDayOfWeek: v ? v.value : undefined })}
              width={20}
            />
          )}
          <TimePickerInput
            value={getTime(value.to)}
            onChange={(v) => onChange({ ...value, to: v ? v.format('HH:mm') : undefined })}
            allowEmpty={true}
            placeholder="HH:mm"
            width={100}
          />
        </HorizontalGroup>
      </Field>
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
    timezoneContainer: css`
      padding: 5px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    `,
    timezone: css`
      margin-right: 5px;
    `,
  };
};
