import moment, { Moment } from 'moment/moment';
import React from 'react';

import { HorizontalGroup, InlineField, InlineFieldRow, Select, TimeZonePicker } from '@grafana/ui';

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

  return (
    <InlineFieldRow>
      <InlineField label="From">
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
      </InlineField>
      <InlineField label="To">
        <HorizontalGroup spacing="xs">
          {value.fromDayOfWeek && (
            <Select
              options={days}
              isClearable
              placeholder="Everyday"
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
      </InlineField>
      <InlineField label="Timezone">
        <TimeZonePicker
          value={value.timezone}
          includeInternal={true}
          onChange={(v) => onChange({ ...value, timezone: v })}
          width={35}
          menuShouldPortal={true}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
