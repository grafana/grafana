import { Action, defaultActionConfig, VariableSuggestion } from '@grafana/data';
import { DataLinksInlineEditorBase, DataLinksInlineEditorBaseProps } from '@grafana/ui';

import { ActionEditorModalContent } from './ActionEditorModalContent';

type DataLinksInlineEditorProps = Omit<DataLinksInlineEditorBaseProps<Action>, 'children' | 'title' | 'items'> & {
  actions: Action[];
  showOneClick?: boolean;
  getSuggestions: () => VariableSuggestion[];
};

export const ActionsInlineEditor = ({ actions, getSuggestions, showOneClick, ...rest }: DataLinksInlineEditorProps) => (
  <DataLinksInlineEditorBase<Action> title="Edit action" items={actions} {...rest}>
    {(item, index, onSave, onCancel) => (
      <ActionEditorModalContent
        index={index}
        action={item ?? defaultActionConfig}
        data={rest.data}
        onSave={onSave}
        onCancel={onCancel}
        getSuggestions={getSuggestions}
        showOneClick={showOneClick ?? false}
      />
    )}
  </DataLinksInlineEditorBase>
);
