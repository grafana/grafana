import React from 'react';
import { FieldTemplateProps } from 'react-jsonschema-form';
import { Field, FieldProps } from '../Field';

const WrapInField: React.FC<FieldProps> = ({ children, ...otherProps }) => {
  return (
    <Field {...otherProps}>
      <>{children}</>
    </Field>
  );
};

export const FieldTemplate: React.FC<FieldTemplateProps> = ({
  label,
  disabled,
  children,
  rawDescription,
  schema,
  rawErrors,
}) => {
  if (schema.type === 'boolean' || schema.type === 'object') {
    // When rendering boolean type, let the CustomBooleanFieldTemplate do it's job
    return children;
  }
  const invalid = rawErrors && rawErrors.length > 0;
  const errorProps = invalid
    ? {
        invalid,
        error: rawErrors[0], // for now only first error, exploring
      }
    : {};

  return (
    <WrapInField {...errorProps} label={label} disabled={disabled} description={rawDescription}>
      {children}
    </WrapInField>
  );
};
