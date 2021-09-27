import React, { FormEvent } from 'react';
import { PanelOptionsEditorProps, PanelProps } from '@grafana/data';
import { Field, Input } from '@grafana/ui';
import { DebugPanelOptions } from './types';

export function StateView(props: PanelProps<DebugPanelOptions>) {
  const onChangeName = (e: FormEvent<HTMLInputElement>) => {
    props.onInstanceStateChange!({
      name: e.currentTarget.value,
    });
  };

  return (
    <Field label="State name">
      <Input value={props.instanceState?.name ?? ''} onChange={onChangeName} />
    </Field>
  );
}

export function StateViewEditor({ value, context, onChange, item }: PanelOptionsEditorProps<string>) {
  return <div>Current value: {context.instanceState?.name} </div>;
}
