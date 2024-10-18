import { css } from '@emotion/css';
import { Dispatch, SetStateAction, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FileDropzone, useStyles2, Button, DropzoneFile, Field } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';

import { MediaType } from '../types';

interface Props {
  setFormData: Dispatch<SetStateAction<FormData>>;
  mediaType: MediaType;
  setUpload: Dispatch<SetStateAction<boolean>>;
  newValue: string;
  error: ErrorResponse;
}
interface ErrorResponse {
  message: string;
}
export function FileDropzoneCustomChildren({ secondaryText = 'Drag and drop here or browse' }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.iconWrapper}>
      <small className={styles.small}>{secondaryText}</small>
      <Button type="button" icon="upload">
        Upload
      </Button>
    </div>
  );
}
export const FileUploader = ({ mediaType, setFormData, setUpload, error }: Props) => {
  const styles = useStyles2(getStyles);
  const [dropped, setDropped] = useState<boolean>(false);
  const [file, setFile] = useState<string>('');

  const Preview = () => (
    <Field label="Preview">
      <div className={styles.iconPreview}>
        {mediaType === MediaType.Icon && <SanitizedSVG src={file} className={styles.img} />}
        {mediaType === MediaType.Image && <img src={file} alt="Preview of the uploaded file" className={styles.img} />}
      </div>
    </Field>
  );

  const onFileRemove = (file: DropzoneFile) => {
    fetch(`/api/storage/delete/upload/${file.file.name}`, {
      method: 'DELETE',
    }).catch((error) => console.error('cannot delete file', error));
  };

  const acceptableFiles =
    mediaType === 'icon' ? { 'image/*': ['.svg', '.xml'] } : { 'image/*': ['.jpeg', '.png', '.gif', '.webp'] };
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
          setFile(URL.createObjectURL(acceptedFiles[0]));
          setDropped(true);
          setFormData(formData);
          setUpload(true);
        },
      }}
    >
      {error.message !== '' && dropped ? (
        <p>{error.message}</p>
      ) : dropped ? (
        <Preview />
      ) : (
        <FileDropzoneCustomChildren />
      )}
    </FileDropzone>
  );
};

function getStyles(theme: GrafanaTheme2, isDragActive?: boolean) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }),
    dropzone: css({
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      padding: theme.spacing(6),
      borderRadius: theme.shape.radius.default,
      border: `2px dashed ${theme.colors.border.medium}`,
      backgroundColor: isDragActive ? theme.colors.background.secondary : theme.colors.background.primary,
      cursor: 'pointer',
    }),
    iconWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }),
    acceptMargin: css({
      margin: theme.spacing(2, 0, 1),
    }),
    small: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    iconContainer: css({
      display: 'flex',
      flexDirection: 'column',
      width: '80%',
      alignItems: 'center',
      alignSelf: 'center',
    }),
    iconPreview: css({
      width: '238px',
      height: '198px',
      border: `1px solid ${theme.colors.border.medium}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    img: css({
      width: '147px',
      height: '147px',
      fill: theme.colors.text.primary,
    }),
  };
}
