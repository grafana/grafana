import { useState } from 'react';

import { DataFrame, Action } from '@grafana/data';

import { Button } from '../Button';
import { Modal } from '../Modal/Modal';

import { ActionEditor } from './ActionEditor';

interface ActionEditorModalContentProps {
  action: Action;
  index: number;
  data: DataFrame[];
  onSave: (index: number, action: Action) => void;
  onCancel: (index: number) => void;
}

// Copy-paste from DataLinkEditorModalContent.tsx
export const ActionEditorModalContent = ({ action, index, onSave, onCancel }: ActionEditorModalContentProps) => {
  const [dirtyAction, setDirtyAction] = useState(action);

  return (
    <>
      <ActionEditor
        value={action}
        index={index}
        onChange={(index, action) => {
          setDirtyAction(action);
        }}
      />
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={() => onCancel(index)} fill="outline">
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave(index, dirtyAction);
          }}
        >
          Save
        </Button>
      </Modal.ButtonRow>
    </>
  );
};
