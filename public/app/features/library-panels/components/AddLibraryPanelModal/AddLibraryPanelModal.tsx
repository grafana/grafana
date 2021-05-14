import React, { useCallback, useEffect, useState } from 'react';
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
  const [waiting, setWaiting] = useState(false);

  useEffect(() => setWaiting(true), [panelTitle]);
  useDebounce(() => setDebouncedPanelTitle(panelTitle), 350, [panelTitle]);

  const { saveLibraryPanel } = usePanelSave();
  const onCreate = useCallback(() => {
    panel.title = panelTitle;
    saveLibraryPanel(panel, folderId!).then((res) => {
      if (!(res instanceof Error)) {
        onDismiss();
      }
    });
  }, [panel, panelTitle, folderId, onDismiss, saveLibraryPanel]);
  const isValidTitle = useAsync(async () => {
    try {
      return !(await getLibraryPanelByName(panelTitle)).some((lp) => lp.folderId === folderId);
    } catch (err) {
      err.isHandled = true;
      return true;
    } finally {
      setWaiting(false);
    }
  }, [debouncedPanelTitle, folderId]);

  const invalidInput =
    !isValidTitle?.value && isValidTitle.value !== undefined && panelTitle === debouncedPanelTitle && !waiting;

  return (
    <>
      <Field
        label="Library panel name"
        invalid={invalidInput}
        error={invalidInput ? 'Library panel with this name already exists' : ''}
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
        <Button onClick={onCreate} disabled={invalidInput}>
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
