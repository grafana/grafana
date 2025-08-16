import { useState } from 'react';

import { Action, ActionType, DataFrame, VariableSuggestion } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';

import { ActionEditor } from './ActionEditor';

interface ActionEditorModalContentProps {
  action: Action;
  index: number;
  data: DataFrame[];
  onSave: (index: number, action: Action) => void;
  onCancel: (index: number) => void;
  getSuggestions: () => VariableSuggestion[];
  showOneClick: boolean;
}

export const ActionEditorModalContent = ({
  action,
  index,
  onSave,
  onCancel,
  getSuggestions,
  showOneClick,
}: ActionEditorModalContentProps) => {
  const [dirtyAction, setDirtyAction] = useState(action);

  return (
    <>
      <ActionEditor
        value={dirtyAction}
        index={index}
        onChange={(index, action) => {
          setDirtyAction(action);
        }}
        suggestions={getSuggestions()}
        showOneClick={showOneClick}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel(index)} fill="outline">
          <Trans i18nKey="action-editor.modal.cancel-button">Cancel</Trans>
        </Button>
        <Button
          onClick={() => {
            onSave(index, dirtyAction);
          }}
          disabled={
            dirtyAction.title.trim() === '' ||
            !dirtyAction[dirtyAction.type]?.url?.trim() ||
            (dirtyAction.type === ActionType.Proxy && !dirtyAction[ActionType.Proxy]?.datasourceUid)
          }
        >
          <Trans i18nKey="action-editor.modal.save-button">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
};
