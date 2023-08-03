import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Collapse, Alert, Field, Input } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { saveCurrentCorrelation } from './state/query';

export const CorrelationHelper = ({ vars }: { vars: Array<[string, string]> }) => {
  const dispatch = useDispatch();
  const { register, getValues } = useForm();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Alert title="Correlation Details" severity="info">
      You can use following variables to set up your correlations:
      <pre>
        {vars.map((entry, index) => {
          return `\$\{${entry[0]}\} = ${entry[1]}\n`;
        })}
      </pre>
      <Collapse
        collapsible
        isOpen={isOpen}
        onToggle={() => {
          setIsOpen(!isOpen);
        }}
        label="Label/Description"
      >
        <Field label="Label">
          <Input {...register('label')} />
        </Field>
        <Field label="Description">
          <Input {...register('description')} />
        </Field>
      </Collapse>
      Once you&#39;re happy with your setup, click{' '}
      <Button
        onClick={() => {
          const values = getValues();
          dispatch(
            saveCurrentCorrelation(
              values.label === '' ? undefined : values.label,
              values.description === '' ? undefined : values.description
            )
          );
        }}
      >
        Save
      </Button>
    </Alert>
  );
};
