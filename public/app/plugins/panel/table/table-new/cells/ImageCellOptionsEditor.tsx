import { FormEvent } from 'react';

import { TableImageCellOptions } from '@grafana/schema';
import { Field, Input } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const ImageCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TableImageCellOptions>) => {
  const onAltChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.alt = e.currentTarget.value;
    onChange(cellOptions);
  };

  const onTitleChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.title = e.currentTarget.value;
    onChange(cellOptions);
  };

  return (
    <>
      <Field
        label="Alt text"
        description="Alternative text that will be displayed if an image can't be displayed or for users who use a screen reader"
      >
        <Input onChange={onAltChange} defaultValue={cellOptions.alt} />
      </Field>

      <Field label="Title text" description="Text that will be displayed when the image is hovered by a cursor">
        <Input onChange={onTitleChange} defaultValue={cellOptions.title} />
      </Field>
    </>
  );
};
