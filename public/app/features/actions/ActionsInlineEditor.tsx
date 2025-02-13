import { Action, defaultActionConfig, VariableSuggestion } from '@grafana/data';
import { DataLinksInlineEditorBase, DataLinksInlineEditorBaseProps } from '@grafana/ui';

import { ActionEditorModalContent } from './ActionEditorModalContent';

type DataLinksInlineEditorProps = Omit<DataLinksInlineEditorBaseProps<Action>, 'children' | 'type' | 'items'> & {
  actions: Action[];
  showOneClick?: boolean;
  getSuggestions: () => VariableSuggestion[];
};

export const ActionsInlineEditor = ({
  actions,
  getSuggestions,
  showOneClick = false,
  ...rest
}: DataLinksInlineEditorProps) => (
  <DataLinksInlineEditorBase<Action> type="action" items={actions} {...rest}>
    {(item, index, onSave, onCancel) => (
      <ActionEditorModalContent
        index={index}
        action={item ?? defaultActionConfig}
        data={rest.data}
        onSave={onSave}
        onCancel={onCancel}
        getSuggestions={getSuggestions}
        showOneClick={showOneClick}
      />
    )}
  </DataLinksInlineEditorBase>
);
