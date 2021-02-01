import React from 'react';
import { Button, Field, Input, Modal, useStyles } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { PanelModel } from '../../../dashboard/state';
import { css } from 'emotion';

interface Props {
  onDismiss: () => void;
  isOpen?: boolean;
  panel: PanelModel;
  initialFolderId?: number;
}

export const AddLibraryPanelModal: React.FC<Props> = ({ isOpen = false, ...props }) => {
  const styles = useStyles(getStyles);

  return (
    <Modal title="Add this panel to the panel library" isOpen={isOpen} onDismiss={props.onDismiss}>
      <Field label="Please set a name for the new reusable panel:">
        <Input name="name" defaultValue={props.panel.title} />
      </Field>
      <Field label="Your reusable panel will be saved in:">
        <FolderPicker onChange={() => {}} initialFolderId={props.initialFolderId} />
      </Field>

      <div className={styles.buttons}>
        <Button>Add panel to the panel library</Button>
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
