import React, { useState } from 'react';

import { Button, Collapse, Alert, Field, Input } from '@grafana/ui';

import { saveCurrentCorrelation } from './state/query';

export const CorrelationHelper = ({ vars }: { vars: Array<[string, string]> }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState();
  const [description, setDescription] = useState();

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
          <Input value={label} onBlur={() => setLabel} />
        </Field>
        <Field label="Description">
          <Input value={description} onBlur={() => setDescription} />
        </Field>
      </Collapse>
      Once you&#39;re happy with your setup, click{' '}
      <Button onClick={() => saveCurrentCorrelation(label, description)}>Save</Button>
    </Alert>
  );
};
