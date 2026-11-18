import { type FormEvent, useId } from 'react';

import { t } from '@grafana/i18n';
import { type TableImageCellOptions } from '@grafana/schema';
import { Field, Input } from '@grafana/ui';

import { type TableCellEditorProps } from '../TableCellOptionEditor';

// A function (not a constant) so the labels stay single-sourced between rendering and the
// options-pane search keywords (see #136909) without top-level translations
export function getImageCellOptionLabels() {
  return {
    altText: t('table.image-cell-options-editor.label-alt-text', 'Alt text'),
    titleText: t('table.image-cell-options-editor.label-title-text', 'Title text'),
  };
}

export const ImageCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TableImageCellOptions>) => {
  const onAltChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.alt = e.currentTarget.value;
    onChange(cellOptions);
  };

  const onTitleChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.title = e.currentTarget.value;
    onChange(cellOptions);
  };

  const altTextInputId = useId();
  const titleTextInputId = useId();
  const labels = getImageCellOptionLabels();

  return (
    <>
      <Field
        noMargin
        label={labels.altText}
        description={t(
          'table.image-cell-options-editor.description-alt-text',
          "Alternative text that will be displayed if an image can't be displayed or for users who use a screen reader"
        )}
      >
        <Input id={altTextInputId} onChange={onAltChange} defaultValue={cellOptions.alt} />
      </Field>

      <Field
        noMargin
        label={labels.titleText}
        description={t(
          'table.image-cell-options-editor.description-title-text',
          'Text that will be displayed when the image is hovered by a cursor'
        )}
      >
        <Input id={titleTextInputId} onChange={onTitleChange} defaultValue={cellOptions.title} />
      </Field>
    </>
  );
};
