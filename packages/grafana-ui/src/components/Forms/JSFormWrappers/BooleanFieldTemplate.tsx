import React from 'react';
import { FieldProps } from 'react-jsonschema-form';
import { getDefaultRegistry, getWidget, getUiOptions } from 'react-jsonschema-form/lib/utils';
import { Field } from '../Field';

export const BooleanFieldTemplate: React.FC<FieldProps> = ({
  schema,
  name,
  uiSchema,
  idSchema,
  formData,
  registry = getDefaultRegistry(),
  required,
  disabled,
  readonly,
  autofocus,
  onChange,
  onFocus,
  onBlur,
  rawErrors,
}) => {
  const { title, description } = schema;
  const { widgets, formContext } = registry;
  // @ts-ignore
  const { widget = 'checkbox', ...options } = getUiOptions(uiSchema);
  const Widget = getWidget(schema, widget, widgets);

  return (
    <Field label={title} description={description} horizontal={!!(options && options.horizontal)}>
      {Widget && (
        // @ts-ignore
        <Widget
          options={{ ...options }}
          schema={schema}
          id={idSchema && idSchema.$id}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          label={title === undefined ? name : title}
          value={formData}
          required={required}
          disabled={disabled}
          readonly={readonly}
          registry={registry}
          formContext={formContext}
          autofocus={autofocus}
          rawErrors={rawErrors}
        />
      )}
    </Field>
  );
};
