import React, { FormEvent } from 'react';

import { DataFrameSchema } from '@grafana/data';
import { InlineField, Input, FieldSet } from '@grafana/ui';
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
              defaultValue={config.value?.[field.name]}
              onChange={(e: FormEvent<HTMLInputElement>) => {
                const newValue = e.currentTarget.valueAsNumber;
                onChange({ ...config, [field.name]: newValue });
              }}
            />
          ) : field.type === 'boolean' ? (
            <Input
              type="checkbox"
              defaultValue={config.value?.[field.name]}
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
