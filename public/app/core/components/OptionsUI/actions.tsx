import { Action, DataLinksFieldConfigSettings, StandardEditorProps, VariableSuggestionsScope } from '@grafana/data';
import { ActionsInlineEditor } from 'app/features/actions/ActionsInlineEditor';

type Props = StandardEditorProps<Action[], DataLinksFieldConfigSettings>;

export const ActionsValueEditor = ({ value, onChange, context }: Props) => {
  return (
    <ActionsInlineEditor
      actions={value}
      onChange={onChange}
      data={context.data}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
    />
  );
};
