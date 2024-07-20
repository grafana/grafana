import { Action, DataLink, DataLinksFieldConfigSettings, StandardEditorProps, VariableSuggestionsScope } from '@grafana/data';
import { DataLinksInlineEditor } from '@grafana/ui';
import { ActionsInlineEditor } from '@grafana/ui/src/components/Actions/ActionsInlineEditor';

type Props = StandardEditorProps<DataLink[], DataLinksFieldConfigSettings>;

export const DataLinksValueEditor = ({ value, onChange, context }: Props) => {
  return (
    <DataLinksInlineEditor
      links={value}
      onChange={onChange}
      data={context.data}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
    />
  );
};

type Props2 = StandardEditorProps<Action[], DataLinksFieldConfigSettings>;

export const ActionsValueEditor = ({ value, onChange, context }: Props2) => {
  return (
    <ActionsInlineEditor
      actions={value}
      onChange={onChange}
      data={context.data}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
    />
  );
};
