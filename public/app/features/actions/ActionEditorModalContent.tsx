import { useState } from 'react';

import { Action, DataFrame, VariableSuggestion } from '@grafana/data';
import { Button } from '@grafana/ui/src/components/Button';
import { Modal } from '@grafana/ui/src/components/Modal/Modal';
import { Trans } from 'app/core/internationalization';

import { ActionEditor } from './ActionEditor';

interface ActionEditorModalContentProps {
  action: Action;
  index: number;
  data: DataFrame[];
  onSave: (index: number, action: Action) => void;
  onCancel: (index: number) => void;
  getSuggestions: () => VariableSuggestion[];
}

export const ActionEditorModalContent = ({
  action,
  index,
  onSave,
  onCancel,
  getSuggestions,
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
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel(index)} fill="outline">
          <Trans i18nKey="action-editor.modal.cancel-button">Cancel</Trans>
        </Button>
        <Button
          onClick={() => {
            onSave(index, dirtyAction);
          }}
          disabled={dirtyAction.title.trim() === '' || dirtyAction.fetch.url.trim() === ''}
        >
          <Trans i18nKey="action-editor.modal.save-button">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
};
