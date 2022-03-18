import React, { useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { FileUpload, LegacyForms } from '@grafana/ui';
import { Form } from '../../../../../packages/grafana-ui/src';
const { FormField } = LegacyForms;
export const FileUploader = () => {
  const [path, setPath] = useState<string>('');
  return (
    <form id="form" encType="multipart/form-data" action="/api/storage/upload" method="POST">
      <label>
        Path
        <input type="text" name="path" />
      </label>
      <input type="file" name="file" multiple />
      <input value="Upload" type="submit" />
    </form>
    //   <>
    //   <FormField
    //     label="Path"
    //     name="name"
    //     placeholder="/folder/"
    //     value={path}
    //     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPath(e.currentTarget.value)}
    //     />
    //   <FileUpload
    //     onFileUpload={async ({ currentTarget }) => {
    //       let image = currentTarget?.files[0];
    //       const buffer = await image.arrayBuffer();
    //       let byteArray = new Int8Array(buffer);
    //       console.log(byteArray)
    //       getBackendSrv()
    //       .post('/api/storage/upload', {
    //         MimeType: currentTarget.type,
    //         Path: `/hello`,
    //         Contents: byteArray,
    //         Properties: {key1: 'value1'}
    //       })
    //       .then(data => console.log(data))
    //       .catch(error => console.error(error))
    //     console.log('file', currentTarget, currentTarget?.files && currentTarget.files[0])
    //   }}
    // />
    // </>
  );
};
