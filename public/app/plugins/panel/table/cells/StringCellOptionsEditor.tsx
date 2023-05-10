import React, { FormEvent, FormEventHandler } from 'react';

import { TableStringCellOptions } from '@grafana/schema';
import { Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const StringCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TableStringCellOptions>) => {
  const onSanitizeChange: FormEventHandler<HTMLInputElement> = (e) => {
    onChange({ ...cellOptions, sanitizeHTML: e.currentTarget.checked });
  };

  return (
    <Field label="Sanitize HTML">
      <Switch onChange={onSanitizeChange} />
    </Field>
  );
};
