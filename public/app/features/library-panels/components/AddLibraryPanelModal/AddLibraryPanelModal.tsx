import React, { useState } from 'react';
import { Button, Field, Input, Modal } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { PanelModel } from '../../../dashboard/state';
import { usePanelSave } from '../../utils/usePanelSave';
import { useAsync, useDebounce } from 'react-use';
import { getLibraryPanelByName } from '../../state/api';
interface AddLibraryPanelContentsProps {
  onDismiss: () => void;
  panel: PanelModel;
  initialFolderId?: number;
}

export const AddLibraryPanelContents = ({ panel, initialFolderId, onDismiss }: AddLibraryPanelContentsProps) => {
  const [folderId, setFolderId] = useState(initialFolderId);
  const [panelTitle, setPanelTitle] = useState(panel.title);
  const [debouncedPanelTitle, setDebouncedPanelTitle] = useState(panel.title);

  useDebounce(() => setDebouncedPanelTitle(panelTitle), 350, [panelTitle]);
  const isValidTitle = useAsync(async () => {
    try {
      await getLibraryPanelByName(panelTitle);
      return false;
    } catch (err) {
      err.isHandled = true;
      return true;
    }
  }, [debouncedPanelTitle]);
  const disableSubmit = !isValidTitle?.value && isValidTitle.value !== undefined;
  const { saveLibraryPanel } = usePanelSave();

  return (
    <>
      <Field
        label="Library panel name"
        invalid={!isValidTitle.loading && !isValidTitle?.value}
        error={!isValidTitle.loading && !isValidTitle?.value ? 'Library panel with this name already exists' : ''}
      >
        <Input name="name" value={panelTitle} onChange={(e) => setPanelTitle(e.currentTarget.value)} />
      </Field>
      <Field label="Save in folder" description="Library panel permissions are derived from the folder permissions">
        <FolderPicker onChange={({ id }) => setFolderId(id)} initialFolderId={initialFolderId} />
      </Field>

      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <Button
          onClick={() => {
            panel.title = panelTitle;
            saveLibraryPanel(panel, folderId!).then(
              () => onDismiss,
              () => {}
            );
          }}
          disabled={disableSubmit}
        >
          Create library panel
        </Button>
      </Modal.ButtonRow>
    </>
  );
};

interface Props extends AddLibraryPanelContentsProps {
  isOpen?: boolean;
}

export const AddLibraryPanelModal: React.FC<Props> = ({ isOpen = false, panel, initialFolderId, ...props }) => {
  return (
    <Modal title="Create library panel" isOpen={isOpen} onDismiss={props.onDismiss}>
      <AddLibraryPanelContents panel={panel} initialFolderId={initialFolderId} onDismiss={props.onDismiss} />
    </Modal>
  );
};
