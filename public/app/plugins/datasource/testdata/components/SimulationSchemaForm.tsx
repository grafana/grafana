import React, { FormEvent, useEffect } from 'react';

import { DataFrameSchema } from '@grafana/data';
import { Checkbox, InlineField, Input, FieldSet } from '@grafana/ui';
interface SchemaFormProps {
  config: Record<string, any>;
  schema: DataFrameSchema;
  onChange: (config: Record<string, any>) => void;
}

export const SimulationSchemaForm = ({ config, schema, onChange }: SchemaFormProps) => {
  return (
    <FieldSet>
      {schema.fields.map((field) => (
        <InlineField label={field.name} key={field.name}>
          {field.type === 'number' ? (
            <Input
              type="number"
              value={config.value?.[field.name] ?? 0}
              onChange={(e: FormEvent<HTMLInputElement>) => {
                const newValue = e.currentTarget.valueAsNumber;
                onChange({ ...config, [field.name]: newValue });
              }}
            />
          ) : field.type === 'boolean' ? (
            <Checkbox
              value={config.value?.[field.name] ?? true}
              onChange={() => {
                onChange({ ...config, [field.name]: !config?.value?.[field.name] });
              }}
            />
          ) : (
            <></>
          )}
        </InlineField>
      ))}
    </FieldSet>
  );
};
