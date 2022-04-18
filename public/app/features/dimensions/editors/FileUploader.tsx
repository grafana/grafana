import React, { Dispatch, SetStateAction, useState } from 'react';
import { FileDropzone, useTheme2, Button, DropzoneFile, Field, Label } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { MediaType } from '../types';
import SVG from 'react-inlinesvg';
interface Props {
  setFormData: Dispatch<SetStateAction<FormData>>;
  mediaType: MediaType;
  setUpload: Dispatch<SetStateAction<boolean>>;
  newValue: string;
}

export function FileDropzoneCustomChildren({ secondaryText = 'Drag and drop here or browse' }) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.iconWrapper}>
      <small className={styles.small}>{secondaryText}</small>
      <Button icon="upload">Upload</Button>
    </div>
  );
}
export const FileUploader = ({ mediaType, setFormData, setUpload, newValue }: Props) => {
  const [dropped, setDropped] = useState<boolean>(false);
  console.log(newValue);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const onFileRemove = (file: DropzoneFile) => {
    fetch(`/api/storage/delete/upload/${file.file.name}`, {
      method: 'DELETE',
    }).catch((error) => console.error('cannot delete file', error));
  };
  const acceptableFiles =
    mediaType === 'icon' ? 'image/svg+xml' : 'image/jpeg,image/png,image/gif,image/png, image/webp';
  return (
    <FileDropzone
      readAs="readAsBinaryString"
      onFileRemove={onFileRemove}
      options={{
        accept: acceptableFiles,
        multiple: false,
        onDrop: (acceptedFiles: File[]) => {
          let formData = new FormData();
          formData.append('file', acceptedFiles[0]);
          setDropped(true);
          setFormData(formData);
          setUpload(true);
        },
      }}
    >
      {dropped ? (
        <div className={styles.iconContainer}>
          <Field label="Preview">
            <div className={styles.iconPreview}>
              {mediaType === MediaType.Icon && <SVG src={newValue} className={styles.img} />}
              {mediaType === MediaType.Image && newValue && <img src={newValue} className={styles.img} />}
            </div>
          </Field>
          <Label>uploaded</Label>
        </div>
      ) : (
        <FileDropzoneCustomChildren />
      )}
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
      margin-bottom: ${theme.spacing(2)};
    `,
    iconContainer: css`
      display: flex;
      flex-direction: column;
      width: 80%;
      align-items: center;
      align-self: center;
    `,
    iconPreview: css`
      width: 238px;
      height: 198px;
      border: 1px solid ${theme.colors.border.medium};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    img: css`
      width: 147px;
      height: 147px;
      fill: ${theme.colors.text.primary};
    `,
  };
}
