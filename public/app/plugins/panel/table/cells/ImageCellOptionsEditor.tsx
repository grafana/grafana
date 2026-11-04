import { type FormEvent, useId } from 'react';

import { t } from '@grafana/i18n';
import { type TableImageCellOptions } from '@grafana/schema';
import { Input } from '@grafana/ui';

import {
  type TableCellOptionEditorDefinition,
  type TableCellOptionEditorProps,
  renderCellOptionEditors,
} from './TableCellOptionEditorRegistry';

type Props = TableCellOptionEditorProps<TableImageCellOptions>;

const AltTextEditor = ({ cellOptions, onChange }: Props) => {
  const onAltChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.alt = e.currentTarget.value;
    onChange(cellOptions);
  };
  const altTextInputId = useId();
  return <Input id={altTextInputId} onChange={onAltChange} defaultValue={cellOptions.alt} />;
};

const TitleTextEditor = ({ cellOptions, onChange }: Props) => {
  const onTitleChange = (e: FormEvent<HTMLInputElement>) => {
    cellOptions.title = e.currentTarget.value;
    onChange(cellOptions);
  };
  const titleTextInputId = useId();
  return <Input id={titleTextInputId} onChange={onTitleChange} defaultValue={cellOptions.title} />;
};

export const imageCellOptionEditors: Array<TableCellOptionEditorDefinition<TableImageCellOptions>> = [
  {
    id: 'alt',
    name: () => t('table.image-cell-options-editor.label-alt-text', 'Alt text'),
    description: () =>
      t(
        'table.image-cell-options-editor.description-alt-text',
        "Alternative text that will be displayed if an image can't be displayed or for users who use a screen reader"
      ),
    Editor: AltTextEditor,
  },
  {
    id: 'title',
    name: () => t('table.image-cell-options-editor.label-title-text', 'Title text'),
    description: () =>
      t(
        'table.image-cell-options-editor.description-title-text',
        'Text that will be displayed when the image is hovered by a cursor'
      ),
    Editor: TitleTextEditor,
  },
];

export const ImageCellOptionsEditor = (props: Props) => renderCellOptionEditors(imageCellOptionEditors, props);
