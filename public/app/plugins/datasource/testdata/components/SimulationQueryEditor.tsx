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
  Switch,
} from '@grafana/ui';
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
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
interface Config {
  tankCapacity: number;
  fillRate: number;
  drainRate: number;
  drainOpen: boolean;
  pumpOn: boolean;
}
export const SimulationQueryEditor = ({ onChange, query, ds }: EditorProps) => {
  const simQuery = query.sim ?? ({} as SimulationQuery);
  const simKey = simQuery.key ?? ({} as typeof simQuery.key);
  const [cfg, setCfg] = useState<Config>({
    tankCapacity: 100,
    fillRate: 1,
    drainRate: 0.5,
    drainOpen: false,
    pumpOn: true,
  });

  // This only changes once
  const info = useAsync(async () => {
    const v = (await ds.getResource('sims')) as SimInfo[];
    console.log(v);
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

  // let config = useAsync(async () => {
  //   let path = simKey.type + '/' + simKey.tick + 'hz';
  //   if (simKey.uid) {
  //     path += '/' + simKey.uid;
  //   }
  //   return (await ds.getResource('sim/' + path))?.config;
  // }, [simKey.type, simKey.tick, simKey.uid]);

  useEffect(() => {
    let path = simKey.type + '/' + simKey.tick + 'hz';
    if (simKey.uid) {
      path += '/' + simKey.uid;
    }
    ds.getResource('sim/' + path).then((data) => setCfg(data.config));
  }, [simKey.type, simKey.tick, simKey.uid, ds]);

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
  const onSubmitChange = () => {
    let path = simKey.type + '/' + simKey.tick + 'hz';
    if (simKey.uid) {
      path += '/' + simKey.uid;
    }
    ds.postResource('sim/' + path, { cfg });
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
          {() => (
            <FieldSet label="Config">
              <InlineField label="Tank capacity">
                <Input
                  type="number"
                  name="tank capacity"
                  value={cfg.tankCapacity}
                  onChange={(e: FormEvent<HTMLInputElement>) => {
                    setCfg({ ...cfg, tankCapacity: e.currentTarget.valueAsNumber });
                  }}
                />
              </InlineField>
              <InlineField label="Fill rate">
                <Input
                  name="fill rate"
                  type="number"
                  value={cfg.fillRate}
                  onChange={(e: FormEvent<HTMLInputElement>) => {
                    setCfg({ ...cfg, fillRate: e.currentTarget.valueAsNumber });
                  }}
                />
              </InlineField>
              <InlineField label="Drain rate">
                <Input
                  name="drain rate"
                  type="number"
                  value={cfg.drainRate}
                  onChange={(e: FormEvent<HTMLInputElement>) => {
                    setCfg({ ...cfg, drainRate: e.currentTarget.valueAsNumber });
                  }}
                />
              </InlineField>
              <InlineField label="Drain open">
                <Switch
                  value={cfg.drainOpen}
                  onChange={(e: FormEvent<HTMLInputElement>) => {
                    setCfg({ ...cfg, drainOpen: !cfg.drainOpen });
                  }}
                />
              </InlineField>
              <InlineField label="Pump on">
                <Switch
                  value={cfg.pumpOn}
                  onChange={(e: FormEvent<HTMLInputElement>) => {
                    setCfg({ ...cfg, pumpOn: !cfg.pumpOn });
                  }}
                />
              </InlineField>
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
