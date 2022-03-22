import React from 'react';
import { FileDropzone } from '@grafana/ui';

export const FileUploader = () => {
  return (
    <FileDropzone
      readAs="readAsArrayBuffer"
      options={{
        multiple: false,
        onDrop: (acceptedFiles: any[]) => {
          let formData = new FormData();
          formData.append('file', acceptedFiles[0]);
          fetch('/api/storage/upload', {
            method: 'POST',
            body: formData,
          })
            .then((r) => r.json())
            .then((data) => {
              console.log(data);
            });
        },
      }}
    />
  );
};
