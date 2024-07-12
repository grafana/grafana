import { DataLink, DataLinksFieldConfigSettings, StandardEditorProps, VariableSuggestionsScope } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';

type Props = StandardEditorProps<DataLink[], DataLinksFieldConfigSettings>;

export const DataLinksValueEditor = ({ value, onChange, context }: Props) => {
  // Ideally we can implement the one-click toggle here but I'm not sure how to do it
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      data={context.data}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
      oneClickEnabled={context.options?.oneClickLinks}
    />
  );
};
