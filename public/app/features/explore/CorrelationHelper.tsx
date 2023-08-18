import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Collapse, Alert, Field, Input } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { changeCorrelationDetails } from './state/main';

export const CorrelationHelper = ({ vars }: { vars: Array<[string, string]> }) => {
  const dispatch = useDispatch();
  const { register, watch } = useForm();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const subscription = watch((value, { name, type }) =>
    {
      dispatch(changeCorrelationDetails({label: value.label, description: value.description}));
    }
    )
    return () => subscription.unsubscribe()
  }, [dispatch, watch])

  // only fire once on mount to allow save button to enable
  useEffect(() => {
    dispatch(changeCorrelationDetails({valid: true}));
  }, [dispatch]);

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
    </Alert>
  );
};
