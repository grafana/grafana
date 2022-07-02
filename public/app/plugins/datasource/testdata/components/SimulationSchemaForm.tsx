import { css } from '@emotion/css';
import React, { FormEvent, useState, ChangeEvent } from 'react';

import { DataFrameSchema, FieldSchema, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TextArea, InlineField, Input, FieldSet, InlineSwitch } from '@grafana/ui';

interface SchemaFormProps {
  config: Record<string, any>;
  schema: DataFrameSchema;
  onChange: (config: Record<string, any>) => void;
}

const renderInput = (field: FieldSchema, onChange: SchemaFormProps['onChange'], config: SchemaFormProps['config']) => {
  switch (field.type) {
    case 'number':
      return (
        <Input
          type="number"
          defaultValue={config?.[field.name]}
          onChange={(e: FormEvent<HTMLInputElement>) => {
            const newValue = e.currentTarget.valueAsNumber;
            onChange({ ...config, [field.name]: newValue });
          }}
        />
      );
    case 'boolean':
      return (
        <InlineSwitch
          value={config?.[field.name] ?? true}
          onChange={() => {
            onChange({ ...config, [field.name]: !config[field.name] });
          }}
        />
      );
    default:
      return (
        <Input
          type="string"
          value={config?.[field.name]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            onChange({ ...config, [field.name]: newValue });
          }}
        />
      );
  }
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    jsonView: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};

export const SimulationSchemaForm = ({ config, schema, onChange }: SchemaFormProps) => {
  const [jsonView, setJsonView] = useState<boolean>(false);

  const styles = useStyles2(getStyles);

  const onUpdateTextArea = (event: FormEvent<HTMLTextAreaElement>) => {
    const element = event.target as HTMLInputElement;
    onChange(JSON.parse(element.value));
  };

  return (
    <FieldSet label="Config">
      <InlineSwitch
        className={styles.jsonView}
        label="JSON View"
        showLabel
        value={jsonView}
        onChange={() => setJsonView(!jsonView)}
      />
      {jsonView ? (
        <TextArea defaultValue={JSON.stringify(config, null, 2)} rows={7} onChange={onUpdateTextArea} />
      ) : (
        <>
          {schema.fields.map((field) => (
            <InlineField label={field.name} key={field.name} labelWidth={14}>
              {renderInput(field, onChange, config)}
            </InlineField>
          ))}
        </>
      )}
    </FieldSet>
  );
};
