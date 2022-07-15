import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FileRejection } from 'react-dropzone';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, FileDropzone, Modal, useStyles2 } from '@grafana/ui';

interface Props {
  onFileUpload: (acceptedFiles: File[], rejectedFiles: FileRejection[], overwriteExistingFile: boolean) => void;
  onDismiss: () => void;
}

export function UploadModal({ onDismiss, onFileUpload }: Props) {
  const [overwriteExistingFile, setOverwriteExistingFile] = useState(false);

  const styles = useStyles2(getStyles);

  return (
    <Modal onDismiss={onDismiss} isOpen={true} title="Upload File">
      <div>
        <Checkbox
          value={overwriteExistingFile}
          onChange={() => setOverwriteExistingFile(!overwriteExistingFile)}
          label="Overwrite existing file"
          className={styles.overwriteCheckbox}
        />

        <FileDropzone
          readAs="readAsBinaryString"
          fileListRenderer={() => null}
          options={{
            accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
            multiple: false,
            onDrop: (acceptedFiles, rejectedFiles) => {
              onFileUpload(acceptedFiles, rejectedFiles, overwriteExistingFile);
              onDismiss();
            },
          }}
        />
      </div>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  overwriteCheckbox: css`
    padding: 10px 0px;
  `,
});
