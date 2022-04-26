import React, { FormEvent, useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataFrameJSON, SelectableValue } from '@grafana/data';
import {
  InlineField,
  InlineFieldRow,
  Button,
  FieldSet,
  InlineSwitch,
  Input,
  Label,
  Select,
  Form,
  TextArea,
} from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { SimulationQuery } from '../types';

// Type         string      `json:"type"`
// Name         string      `json:"name"`
// Description  string      `json:"description"`
// OnlyForward  bool        `json:"forward"`
// ConfigFields *data.Frame `json:"config"`

interface SimInfo {
  type: string;
  name: string;
  description: string;
  forward: boolean;
  config: DataFrameJSON;
}
interface FormDTO {
  config: string;
}
export const SimulationQueryEditor = ({ onChange, query, ds }: EditorProps) => {
  const simQuery = query.sim ?? ({} as SimulationQuery);
  const simKey = simQuery.key ?? ({} as typeof simQuery.key);

  // This only changes once
  const info = useAsync(async () => {
    const v = (await ds.getResource('sims')) as SimInfo[];
    return {
      sims: v,
      options: v.map((s) => ({ label: s.name, value: s.type, description: s.description })),
    };
  }, [ds]);

  const current = useMemo(() => {
    const type = simKey.type;
    if (!type || !info.value) {
      return {};
    }
    return {
      details: info.value.sims.find((v) => v.type === type),
      option: info.value.options.find((v) => v.value === type),
    };
  }, [info.value, simKey?.type]);

  let config = useAsync(async () => {
    let path = simKey.type + '/' + simKey.tick + 'hz';
    if (simKey.uid) {
      path += '/' + simKey.uid;
    }
    return (await ds.getResource('sim/' + path))?.config;
  }, [simKey.type, simKey.tick, simKey.uid]);

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
  const onSubmitChange = (data: FormDTO) => {
    let path = simKey.type + '/' + simKey.tick + 'hz';
    if (simKey.uid) {
      path += '/' + simKey.uid;
    }
    ds.postResource('sim/' + path, JSON.parse(data.config));
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Simulation" tooltip="">
          <Select
            isLoading={info.loading}
            menuShouldPortal
            options={info.value?.options ?? []}
            value={current.option}
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
      <div>
        <Form onSubmit={onSubmitChange}>
          {({ register }) => (
            <FieldSet>
              <TextArea {...register('config')} defaultValue={JSON.stringify(config.value, null, 2)} rows={7} />
              <Button type="submit">Submit</Button>
            </FieldSet>
          )}
        </Form>
        SCHEMA:
        <pre>{JSON.stringify(current.details?.config.schema, null, 2)}</pre>
      </div>
    </>
  );
};
