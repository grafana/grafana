import React, { Dispatch, SetStateAction } from 'react';
import { FileDropzone } from '@grafana/ui';
import { getBackendSrv, config } from '@grafana/runtime';
interface Props {
  newValue: string;
  setNewValue: Dispatch<SetStateAction<string>>;
}

export const FileUploader = (props: Props) => {
  const { setNewValue } = props;
  return (
    <FileDropzone
      readAs="readAsBinaryString"
      options={{
        multiple: false,
        onDrop: (acceptedFiles: File[]) => {
          let formData = new FormData();
          formData.append('file', acceptedFiles[0]);
          fetch('/api/storage/upload', {
            method: 'POST',
            body: formData,
          })
            .then((r) => r.json())
            .then((data) => {
              getBackendSrv()
                .get(`api/storage/read/${data.path}`)
                .then(() => setNewValue(`${config.appUrl}api/storage/read/${data.path}`));
            });

          // getBackendSrv()
          //   .post('/api/storage/upload', formData)
          //   .then((r) => console.log(r));
        },
      }}
    />
  );
};
