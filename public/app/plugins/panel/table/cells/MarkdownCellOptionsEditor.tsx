import { t } from '@grafana/i18n';
import { type TableMarkdownCellOptions } from '@grafana/schema';
import { Badge, Label, Switch } from '@grafana/ui';
import { highlightOptionSearchTerm } from 'app/features/dashboard/components/PanelEditor/OptionSearchHighlight';

import {
  type TableCellOptionEditorDefinition,
  type TableCellOptionEditorProps,
  renderCellOptionEditors,
} from './TableCellOptionEditorRegistry';

type Props = TableCellOptionEditorProps<TableMarkdownCellOptions>;

const DynamicHeightEditor = ({ cellOptions, onChange }: Props) => (
  <Switch
    onChange={(e) => {
      cellOptions.dynamicHeight = e.currentTarget.checked;
      onChange(cellOptions);
    }}
    value={cellOptions.dynamicHeight}
  />
);

export const markdownCellOptionEditors: Array<TableCellOptionEditorDefinition<TableMarkdownCellOptions>> = [
  {
    id: 'dynamicHeight',
    name: () => t('table.markdown-cell-options-editor.label-dynamic-height', 'Dynamic height'),
    Editor: DynamicHeightEditor,
    renderLabel: (name, searchQuery) => (
      <Label
        description={t(
          'table.markdown-cell-options-editor.description-dynamic-height',
          'We recommend enabling pagination with this option to avoid performance issues.'
        )}
      >
        {searchQuery ? highlightOptionSearchTerm(name, searchQuery) : name}{' '}
        <Badge
          text={t('table.markdown-cell-options-editor.label.text-alpha', 'Alpha')}
          color="blue"
          style={{ fontSize: '11px', marginLeft: '5px', lineHeight: '1.2' }}
        />
      </Label>
    ),
  },
];

export const MarkdownCellOptionsEditor = (props: Props) => renderCellOptionEditors(markdownCellOptionEditors, props);
