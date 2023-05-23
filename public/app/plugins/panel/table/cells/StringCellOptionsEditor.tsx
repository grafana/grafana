import React, { FormEventHandler } from 'react';

import { TableStringCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const StringCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TableStringCellOptions>) => {
  const onRenderAsHTMLChange: FormEventHandler<HTMLInputElement> = (e) => {
    onChange({ ...cellOptions, renderAsHTML: e.currentTarget.checked });
  };

  return (
    <Field
      label="Render as HTML"
      description="Sanitize and render the contents of the cell, removing tags such as form input and pre"
    >
      <Switch onChange={onRenderAsHTMLChange} />
    </Field>
  );
};
