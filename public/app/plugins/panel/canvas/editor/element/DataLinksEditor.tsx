import { StandardEditorProps, DataLink, VariableSuggestionsScope, OneClickMode } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { CanvasElementOptions } from 'app/features/canvas/element';

type Props = StandardEditorProps<DataLink[], CanvasElementOptions>;

export function DataLinksEditor({ value, onChange, item, context }: Props) {
  const oneClickMode = item.settings?.oneClickMode;

  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
      data={[]}
      showOneClick={oneClickMode === OneClickMode.Link}
    />
  );
}
