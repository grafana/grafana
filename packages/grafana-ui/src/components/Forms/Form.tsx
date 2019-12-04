/**
 * This is a stub implementation only for correct styles to be applied
 */

import React from 'react';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { default as JSForm, UiSchema, ISubmitEvent, IChangeEvent, ErrorSchema } from 'react-jsonschema-form';
import { JSONSchema6 } from 'json-schema';
import { FieldTemplate } from './JSFormWrappers/FieldTemplate';
import { ObjectFieldTemplate } from './JSFormWrappers/ObjectFieldTemplate';
import { TextWidget } from './JSFormWrappers/TextWidget';
import { BooleanFieldTemplate } from './JSFormWrappers/BooleanFieldTemplate';
import { CheckboxWidget } from './JSFormWrappers/CheckboxWidget';
import { SwitchWidget } from './JSFormWrappers/SwitchWidget';

const getFormStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    form: css`
      margin-bottom: ${theme.spacing.formMargin};
    `,
  };
});

interface FormProps<T = any> {
  schema?: JSONSchema6;
  uiSchema?: UiSchema;
  formData?: T;
  onSubmit?: (e: ISubmitEvent<T>) => void;
  onChange?: (e: IChangeEvent<T>, es?: ErrorSchema) => any;
}

export const Form: React.FC<FormProps> = ({ children, schema, uiSchema, onSubmit, onChange }) => {
  const theme = useTheme();
  const styles = getFormStyles(theme);

  if (schema) {
    return (
      <JSForm
        onSubmit={onSubmit}
        onBlur={(id, value) => {
          console.log(id, value);
        }}
        showErrorList={false}
        onChange={onChange}
        schema={schema}
        uiSchema={uiSchema}
        ObjectFieldTemplate={ObjectFieldTemplate}
        FieldTemplate={FieldTemplate}
        widgets={{
          TextWidget: TextWidget,
          EmailWidget: TextWidget,
          CheckboxWidget: CheckboxWidget,
          switch: SwitchWidget,
        }}
        fields={{
          BooleanField: BooleanFieldTemplate,
        }}
      >
        {children}
      </JSForm>
    );
  }
  return <div className={styles.form}>{children}</div>;
};
