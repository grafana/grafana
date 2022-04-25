import React, { FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Label, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { SimulationQuery } from '../types';

export const SimulationQueryEditor = ({ onChange, query }: EditorProps) => {
  const simQuery = query.sim ?? ({} as SimulationQuery);
  const simKey = simQuery.key ?? ({} as typeof simQuery.key);
  const options = [
    { label: 'Flight', value: 'flight' },
    { label: 'Sine', value: 'sine' },
    { label: 'Tank', value: 'tank' },
  ];

  const onUpdateKey = (key: typeof simQuery.key) => {
    onChange({ ...query, sim: { ...simQuery, key } });
  };

  const onUIDChanged = (e: FormEvent<HTMLInputElement>) => {
    const { value } = e.target as HTMLInputElement;
    onUpdateKey({ ...simKey, uid: value ?? undefined });
  };

  const onTickChanged = (e: FormEvent<HTMLInputElement>) => {
    const tick = e.currentTarget.valueAsNumber;
    onUpdateKey({ ...simKey, tick });
  };

  const onTypeChange = (v: SelectableValue<string>) => {
    onUpdateKey({ ...simKey, type: v.value! });
  };

  const onToggleStream = () => {
    onChange({ ...query, sim: { ...simQuery, stream: !simQuery.stream } });
  };

  const onToggleLast = () => {
    onChange({ ...query, sim: { ...simQuery, last: !simQuery.last } });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Simulation" tooltip="">
          <Select
            options={options}
            value={options.find((item) => item.value === simQuery.key?.type)}
            onChange={onTypeChange}
            width={32}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField labelWidth={14} label="Stream" tooltip="connect to the live channel">
          <InlineSwitch value={Boolean(simQuery.stream)} onChange={onToggleStream} />
        </InlineField>

        <InlineField label="Interval" tooltip="the rate a simulation will spit out events">
          <Input
            width={10}
            type="number"
            value={simKey.tick}
            onChange={onTickChanged}
            min={1 / 10}
            max={50}
            suffix="hz"
          />
        </InlineField>

        <InlineField label="Last" tooltip="Only return the last value">
          <Label>
            <InlineSwitch value={Boolean(simQuery.last)} onChange={onToggleLast} />
          </Label>
        </InlineField>
        <InlineField label="UID" tooltip="A UID will allow multiple simulations to run at the same time">
          <Input type="text" placeholder="optional" value={simQuery.key.uid} onChange={onUIDChanged} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
