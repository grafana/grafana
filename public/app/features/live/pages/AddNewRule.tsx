import React from 'react';
import { Input, Form, Field, Button } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { Rule } from './types';

interface Props {
  onClose: (state: boolean) => void;
}
export function AddNewRule({ onClose }: Props) {
  const onSubmit = (formData: Rule) => {
    getBackendSrv()
      .post(`api/live/channel-rules`, {
        pattern: formData.pattern,
        settings: {
          output: formData.settings.output,
          converter: formData.settings.converter,
        },
      })
      .then(() => {
        // close modal
        onClose(false);
      })
      .catch((e) => console.error(e));
  };

  return (
    <Form
      defaultValues={{
        pattern: '',
        settings: {
          converter: {
            type: 'jsonAuto',
          },
          output: {
            type: 'managedStream',
          },
        },
      }}
      onSubmit={onSubmit}
    >
      {({ register, errors }) => (
        <>
          <Field label="Pattern" invalid={!!errors.pattern} error="Pattern is required">
            <Input {...register('pattern', { required: true })} placeholder="scope/namespace/path" />
          </Field>
          <Button>Add</Button>
        </>
      )}
    </Form>
  );
}
