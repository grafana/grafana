import React, { FormEvent } from 'react';

import { PanelOptionsEditorProps, PanelProps } from '@grafana/data';
import { Field, Input, usePanelContext } from '@grafana/ui';

import { DebugPanelOptions } from './types';

export function StateView(props: PanelProps<DebugPanelOptions>) {
  const context = usePanelContext();

  const onChangeName = (e: FormEvent<HTMLInputElement>) => {
    context.onInstanceStateChange!({
      name: e.currentTarget.value,
    });
  };

  return (
    <>
      <Field label="State name">
        <Input value={context.instanceState?.name ?? ''} onChange={onChangeName} />
      </Field>
    </>
  );
}

export function StateViewEditor({ value, context, onChange, item }: PanelOptionsEditorProps<string>) {
  return <div>Current value: {context.instanceState?.name} </div>;
}
