import React, { useState } from 'react';

import {
  InlineField,
  Select,
  Input,
  InlineFieldRow,
  InlineLabel,
  HorizontalGroup,
  IconButton,
  Button,
} from '@grafana/ui';
import { ColorValueEditor } from 'app/core/components/OptionsUI/color';
import { formatTimeOfDayString, parseTimeOfDay } from 'app/core/utils/timeRegions';

import { TimeRegionConfig } from '../types';

interface Props {
  value?: TimeRegionConfig[];
  onChange: (value?: TimeRegionConfig[]) => void;
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((v, idx) => {
  return {
    label: v,
    value: idx + 1,
  };
});

export function TimeRegionsEditor({ value, onChange }: Props) {
  const addTimeRegion = () => {
    const len = value?.length ?? 0;
    const r: TimeRegionConfig = { name: `T${len + 1}`, color: 'red' };
    onChange(value ? [...value, r] : [r]);
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

function normalizeTimeString(v?: string): string | undefined {
  const parsed = parseTimeOfDay(v);
  const out = formatTimeOfDayString(parsed);
  return out?.length ? out : undefined;
}

function TimeRegionEditor({ value, index, onChange }: SingleRegion) {
  const [fromTxt, setFromText] = useState<string>(normalizeTimeString(value.from) ?? '');
  const [toTxt, setToText] = useState<string>(normalizeTimeString(value.to) ?? '');

  const validateFrom = () => {
    const from = normalizeTimeString(value.from);
    onChange(index, { ...value, from });
    setFromText(from ?? '');
  };

  const validateTo = () => {
    const to = normalizeTimeString(value.to);
    onChange(index, { ...value, to });
    setFromText(to ?? '');
  };

  return (
    <InlineFieldRow>
      <InlineField label="Region" labelWidth={12}>
        <Input
          width={10}
          placeholder="enter name"
          value={value.name}
          onChange={(v) => onChange(index, { ...value, name: v.currentTarget.value })}
        />
      </InlineField>
      <InlineField label="From">
        <HorizontalGroup spacing="none">
          <Select
            options={days}
            isClearable
            placeholder="Everyday"
            value={days.find((v) => v.value === value.fromDayOfWeek)}
            onChange={(v) => onChange(index, { ...value, fromDayOfWeek: v.value })}
          />
          <Input
            width={8}
            value={fromTxt}
            onChange={(v) => setFromText(v.currentTarget.value)}
            placeholder="hh:mm"
            onBlur={validateFrom}
          />
        </HorizontalGroup>
      </InlineField>
      <InlineField label="To">
        <HorizontalGroup spacing="none">
          <Select
            options={days}
            isClearable
            placeholder="Everyday"
            value={days.find((v) => v.value === value.toDayOfWeek)}
            onChange={(v) => onChange(index, { ...value, toDayOfWeek: v.value })}
          />
          <Input
            width={8}
            value={toTxt}
            onChange={(v) => setToText(v.currentTarget.value)}
            placeholder="hh:mm"
            onBlur={validateTo}
          />
        </HorizontalGroup>
      </InlineField>
      <InlineField label="Color">
        <ColorValueEditor value={value.color} onChange={(color) => onChange(index, { ...value, color: color! })} />
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
