import { StandardEditorProps, OneClickMode, Action, VariableSuggestionsScope } from '@grafana/data';
import { ActionsInlineEditor } from '@grafana/ui/src/components/Actions/ActionsInlineEditor';
import { CanvasElementOptions } from 'app/features/canvas/element';

type Props = StandardEditorProps<Action[], CanvasElementOptions>;

export function ActionsEditor({ value, onChange, item, context }: Props) {
  const oneClickMode = item.settings?.oneClickMode;

  return (
    <ActionsInlineEditor
      actions={value}
      onChange={onChange}
      getSuggestions={() => (context.getSuggestions ? context.getSuggestions(VariableSuggestionsScope.Values) : [])}
      data={[]}
      showOneClick={oneClickMode === OneClickMode.Action}
    />
  );
}
