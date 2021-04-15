import React, { useState } from 'react';
import { Button, Field, Input, Modal, useStyles } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { PanelModel } from '../../../dashboard/state';
import { css } from '@emotion/css';
import { usePanelSave } from '../../utils/usePanelSave';
interface AddLibraryPanelContentsProps {
  onDismiss: () => void;
  panel: PanelModel;
  initialFolderId?: number;
}

export const AddLibraryPanelContents = ({ panel, initialFolderId, onDismiss }: AddLibraryPanelContentsProps) => {
  const styles = useStyles(getStyles);
  const [folderId, setFolderId] = useState(initialFolderId);
  const [panelTitle, setPanelTitle] = useState(panel.title);
  const { saveLibraryPanel } = usePanelSave();

  return (
    <>
      <Field label="Library panel name">
        <Input name="name" value={panelTitle} onChange={(e) => setPanelTitle(e.currentTarget.value)} />
      </Field>
      <Field label="Save in folder" description="Library panel permissions are derived from the folder permissions">
        <FolderPicker onChange={({ id }) => setFolderId(id)} initialFolderId={initialFolderId} />
      </Field>

      <div className={styles.buttons}>
        <Button
          onClick={() => {
            panel.title = panelTitle;
            saveLibraryPanel(panel, folderId!).then(() => onDismiss());
          }}
        >
          Add panel to the panel library
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </>
  );
};

interface Props extends AddLibraryPanelContentsProps {
  isOpen?: boolean;
}

export const AddLibraryPanelModal: React.FC<Props> = ({ isOpen = false, panel, initialFolderId, ...props }) => {
  return (
    <Modal title="Add this panel to the panel library" isOpen={isOpen} onDismiss={props.onDismiss}>
      <AddLibraryPanelContents panel={panel} initialFolderId={initialFolderId} onDismiss={props.onDismiss} />
    </Modal>
  );
};

const getStyles = () => ({
  buttons: css`
    display: flex;
    gap: 10px;
  `,
});
