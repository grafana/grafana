import { StandardEditorProps, Action, VariableSuggestionsScope } from '@grafana/data';
import { ActionsInlineEditor } from 'app/features/actions/ActionsInlineEditor';
import { CanvasElementOptions } from 'app/features/canvas/element';

type Props = StandardEditorProps<Action[], CanvasElementOptions>;

export function ActionsEditor({ value, onChange, item, context }: Props) {
  const dataLinks = item.settings?.links || [];

  return (
    <ActionsInlineEditor
      actions={value}
      onChange={onChange}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
      data={[]}
      dataLinks={dataLinks}
    />
  );
}
