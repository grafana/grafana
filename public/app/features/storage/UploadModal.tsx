import React, { useState } from 'react';
import { FileRejection } from 'react-dropzone';

import { Checkbox, FileDropzone, Modal } from '@grafana/ui';

interface Props {
  onFileUpload: (acceptedFiles: File[], rejectedFiles: FileRejection[], overwriteExistingFile: boolean) => void;
  onDismiss: () => void;
}

export function UploadModal({ onDismiss, onFileUpload }: Props) {
  const [overwriteExistingFile, setOverwriteExistingFile] = useState(false);

  return (
    <Modal onDismiss={onDismiss} isOpen={true} title="Upload File">
      <div>
        <Checkbox
          value={overwriteExistingFile}
          onChange={() => setOverwriteExistingFile(!overwriteExistingFile)}
          label="Overwrite existing file"
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
        ></FileDropzone>
      </div>
    </Modal>
  );
}
