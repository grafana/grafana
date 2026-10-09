import { lazy, Suspense } from 'react';

import { type Action, defaultActionConfig, type VariableSuggestion } from '@grafana/data';
import { DataLinksInlineEditorBase, type DataLinksInlineEditorBaseProps, Spinner } from '@grafana/ui';

const ActionEditorModalContent = lazy(() =>
  import('./ActionEditorModalContent').then((module) => ({ default: module.ActionEditorModalContent }))
);

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
  <DataLinksInlineEditorBase<Action> type="action" items={actions} data-testid="actions-inline" {...rest}>
    {(item, index, onSave, onCancel) => (
      <Suspense fallback={<Spinner />}>
        <ActionEditorModalContent
          index={index}
          action={item ?? defaultActionConfig}
          data={rest.data}
          onSave={onSave}
          onCancel={onCancel}
          getSuggestions={getSuggestions}
          showOneClick={showOneClick}
        />
      </Suspense>
    )}
  </DataLinksInlineEditorBase>
);
