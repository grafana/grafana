import React, { Dispatch, SetStateAction } from 'react';
import { FileDropzone, useTheme2, Icon, Button } from '@grafana/ui';
import { getBackendSrv, config } from '@grafana/runtime';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
interface Props {
  setNewValue: Dispatch<SetStateAction<string>>;
}

export function FileDropzoneCustomChildren({
  primaryText = 'Upload file',
  secondaryText = 'Drag and drop here or browse',
}) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.iconWrapper}>
      <Icon name="upload" size="xxl" />
      <h3>{primaryText}</h3>
      <small className={styles.small}>{secondaryText}</small>
      <h6>Or</h6>
      <Button icon="upload">Upload</Button>
    </div>
  );
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
              // TODO: manually trigger error ui
              if (!data.err) {
                getBackendSrv()
                  .get(`api/storage/read/${data.path}`)
                  .then(() => {
                    setNewValue(`${config.appUrl}api/storage/read/${data.path}`);
                  });
              }
            })
            .catch((error) => console.error('cannot upload file', error));
        },
      }}
    >
      <FileDropzoneCustomChildren />
    </FileDropzone>
  );
};

function getStyles(theme: GrafanaTheme2, isDragActive?: boolean) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      width: 100%;
    `,
    dropzone: css`
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      padding: ${theme.spacing(6)};
      border-radius: 2px;
      border: 2px dashed ${theme.colors.border.medium};
      background-color: ${isDragActive ? theme.colors.background.secondary : theme.colors.background.primary};
      cursor: pointer;
    `,
    iconWrapper: css`
      display: flex;
      flex-direction: column;
      align-items: center;
    `,
    acceptMargin: css`
      margin: ${theme.spacing(2, 0, 1)};
    `,
    small: css`
      color: ${theme.colors.text.secondary};
    `,
  };
}
