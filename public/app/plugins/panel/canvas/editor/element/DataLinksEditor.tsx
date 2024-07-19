import { StandardEditorProps, DataLink, VariableSuggestionsScope } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { CanvasElementOptions } from 'app/features/canvas/element';

type Props = StandardEditorProps<DataLink[], CanvasElementOptions>;

export function DataLinksEditor({ value, onChange, item, context }: Props) {
  if (!value) {
    value = [];
  }

  const settings = item.settings;
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
      data={[]}
      oneClickMode={settings?.oneClickMode}
    />
  );
}
