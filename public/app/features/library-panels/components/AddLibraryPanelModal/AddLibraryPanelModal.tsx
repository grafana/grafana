import React, { useState } from 'react';
import { Button, Field, Input, Modal, useStyles } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { PanelModel } from '../../../dashboard/state';
import { css } from 'emotion';
import { usePanelSave } from '../../utils/usePanelSave';

interface Props {
  onDismiss: () => void;
  isOpen?: boolean;
  panel: PanelModel;
  initialFolderId?: number;
}

export const AddLibraryPanelModal: React.FC<Props> = ({ isOpen = false, panel, initialFolderId, ...props }) => {
  const styles = useStyles(getStyles);
  const [folderId, setFolderId] = useState(initialFolderId);
  const [panelTitle, setPanelTitle] = useState(panel.title);
  const { saveLibraryPanel } = usePanelSave();

  return (
    <Modal title="Add this panel to the panel library" isOpen={isOpen} onDismiss={props.onDismiss}>
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
            saveLibraryPanel(panel, folderId!).then(() => props.onDismiss());
          }}
        >
          Add panel to the panel library
        </Button>
        <Button variant="secondary" onClick={props.onDismiss}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};

const getStyles = () => ({
  buttons: css`
    display: flex;
    gap: 10px;
  `,
});
