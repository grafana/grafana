import moment, { Moment } from 'moment/moment';
import React, { useMemo } from 'react';

import {
  Button,
  HorizontalGroup,
  IconButton,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  InlineSwitch,
  Input,
  Select,
  TimeZonePicker,
} from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { TimeRegionConfig } from '../types';

import { TimePickerInput } from './TimePickerInput';
interface Props {
  value?: TimeRegionConfig[];
  onChange: (value?: TimeRegionConfig[]) => void;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((v, idx) => {
  return {
    label: v,
    value: idx + 1,
  };
});

export function TimeRegionsEditor({ value, onChange }: Props) {
  const defaultTimezone = useMemo(() => getDashboardSrv().dashboard?.getTimezone(), []);
  const addTimeRegion = () => {
    const r: TimeRegionConfig = {
      name: getNextRegionName(),
      color: 'rgba(235, 113, 113, 0.40)',
      line: false,
      timezone: defaultTimezone,
    };
    onChange(value ? [...value, r] : [r]);
  };

  const getNextRegionName = () => {
    const label = 'T';
    let idx = value?.length ? value?.length + 1 : 0;
    const max = idx + 100;

    while (true && idx < max) {
      const name = `${label}${idx++}`;
      if (!value?.some((val) => val.name === name)) {
        return name;
      }
    }

    return `${label}${Date.now()}`;
  };

  const onChangeItem = (idx: number, v?: TimeRegionConfig) => {
    let clone = value!.slice(0);

    if (v) {
      clone[idx] = v;
    } else {
      clone.splice(idx, 1);
    }

    onChange(clone);
  };

  return (
    <>
      {value && value.map((v, idx) => <TimeRegionEditor key={idx} value={v} index={idx} onChange={onChangeItem} />)}
      <Button icon="plus" size="md" variant="secondary" onClick={addTimeRegion}>
        Add time region
      </Button>
    </>
  );
}

interface SingleRegion {
  value: TimeRegionConfig;
  index: number;
  onChange: (index: number, value?: TimeRegionConfig) => void;
}

function TimeRegionEditor({ value, index, onChange }: SingleRegion) {
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
      <InlineField label="Region" labelWidth={12}>
        <Input
          placeholder="enter name"
          value={value.name}
          onChange={(v) => onChange(index, { ...value, name: v.currentTarget.value })}
          width={10}
        />
      </InlineField>
      <InlineField label="From">
        <HorizontalGroup spacing="none">
          <Select
            options={days}
            isClearable
            placeholder="Everyday"
            value={value.fromDayOfWeek ?? null}
            onChange={(v) => onChange(index, { ...value, fromDayOfWeek: v ? v.value : undefined })}
            width={20}
          />
          <TimePickerInput
            value={getTime(value.from)}
            onChange={(v) => onChange(index, { ...value, from: v ? v.format('HH:mm') : undefined })}
            allowEmpty={true}
            placeholder="HH:mm"
            width={100}
          />
        </HorizontalGroup>
      </InlineField>
      <InlineField label="To">
        <HorizontalGroup spacing="none">
          <Select
            options={days}
            isClearable
            placeholder="Everyday"
            value={value.toDayOfWeek ?? null}
            onChange={(v) => onChange(index, { ...value, toDayOfWeek: v ? v.value : undefined })}
            width={20}
          />
          <TimePickerInput
            value={getTime(value.to)}
            onChange={(v) => onChange(index, { ...value, to: v ? v.format('HH:mm') : undefined })}
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
          onChange={(v) => onChange(index, { ...value, timezone: v })}
          width={35}
          menuShouldPortal={true}
        />
      </InlineField>
      <InlineField label="Color">
        <ColorValueEditor value={value.color} onChange={(color) => onChange(index, { ...value, color: color! })} />
      </InlineField>
      <InlineField>
        <InlineSwitch
          label="Line"
          showLabel={true}
          value={value.line}
          onChange={(e) => onChange(index, { ...value, line: e.currentTarget.checked })}
        />
      </InlineField>
      <InlineField
        label={
          <InlineLabel>
            <IconButton name="times" onClick={() => onChange(index)} />
          </InlineLabel>
        }
      >
        <></>
      </InlineField>
    </InlineFieldRow>
  );
}
