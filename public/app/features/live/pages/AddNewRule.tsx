import React, { useState, useEffect, useRef } from 'react';
import { Input, Form, Field, Button, Alert } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { Rule } from './types';

export default function AddNewRule() {
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
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
        if (isMounted) {
          setSuccess(true);
        }
      })
      .catch(() => setError(true));
  };
  const onRemoveAlert = () => setSuccess(false);
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
          {success && <Alert title="Saved successfully" severity="success" onRemove={onRemoveAlert} />}
          {error && <Alert title="Failed to save" severity="error" onRemove={onRemoveAlert} />}
        </>
      )}
    </Form>
  );
}
