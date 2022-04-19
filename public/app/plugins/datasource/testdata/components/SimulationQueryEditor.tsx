import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React, { FormEvent } from 'react';
import { EditorProps } from '../QueryEditor';
import { SimulationQuery } from '../types';

export const SimulationQueryEditor = ({ onChange, query }: EditorProps) => {
  const simQuery = query.sim ?? ({} as SimulationQuery);
  const simKey = simQuery.key ?? ({} as typeof simQuery.key);
  const options = [
    { label: 'Flight', value: 'flight' },
    { label: 'Sine', value: 'sine' },
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

  return (
    <InlineFieldRow>
      <InlineField labelWidth={14} label="Simulation" tooltip="">
        <Select
          menuShouldPortal
          options={options}
          value={options.find((item) => item.value === simQuery.key?.type)}
          onChange={onTypeChange}
          width={32}
        />
      </InlineField>
      <InlineField label="Clock" tooltip="the rate a simulation will spit out events">
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
      <InlineField label="UID" tooltip="A UID will allow multiple simulations to run at the same time" grow>
        <Input type="text" placeholder="optional" value={simQuery.key.uid} onChange={onUIDChanged} />
      </InlineField>
    </InlineFieldRow>
  );
};
