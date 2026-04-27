import type { DataLinksFieldConfigSettings, StandardEditorProps } from '@grafana/data/field';
import { type Action, VariableSuggestionsScope } from '@grafana/data/types';
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
