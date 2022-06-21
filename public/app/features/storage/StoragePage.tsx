import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, Spinner, useStyles2, Button, FileDropzone, Field } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getGrafanaStorage } from './helper';

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

export default function StoragePage() {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const [searchQuery, setSearchQuery] = useState('');
  const [path] = useState('resources'); // from URL?
  const [dropped, setDropped] = useState<boolean>(false);
  const [file, setFile] = useState<string>(''); // for preview but might not need
  const [formData, setFormData] = useState<FormData>(new FormData());
  const [error, setError] = useState<ErrorResponse>({ message: '' });
  // TODO: check file uploaded to set mediaType if we want to keep
  // the preview. hardcode as image for now.
  const mediaType = 'image';

  const folder = useAsync(async () => {
    return getGrafanaStorage().list(path);
  }, [path]);

  const Preview = () => (
    <Field label="Preview">
      <div className={styles.iconPreview}>
        {/* TODO: preview icon */}
        {/* {mediaType === 'icon' && <SVG src={file} className={styles.img} />} */}
        {mediaType === 'image' && <img src={file} className={styles.img} />}
      </div>
    </Field>
  );

  const acceptableFiles = 'image/jpeg,image/png,image/gif,image/png, image/webp';

  const renderFolder = () => {
    if (folder.value) {
      return (
        <>
          {/* TODO: should this be hidden under an Upload button? */}
          <FileDropzone
            readAs="readAsBinaryString"
            onFileRemove={() => setDropped(false)}
            options={{
              accept: acceptableFiles,
              multiple: false,
              onDrop: (acceptedFiles: File[]) => {
                let formData = new FormData();
                formData.append('file', acceptedFiles[0]);
                setFile(URL.createObjectURL(acceptedFiles[0]));
                setDropped(true);
                setFormData(formData);
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
          <Button
            className={styles.button}
            variant={dropped ? 'primary' : 'secondary'}
            onClick={() => {
              fetch('/api/storage/resources', {
                method: 'POST',
                body: formData,
              })
                // TODO: once upload is done, show list files
                // and hide the dropzone?
                .then((res) => {
                  if (res.status >= 400) {
                    res.json().then((data) => setError(data));
                    return;
                  } else {
                    setDropped(false);
                    return res.json();
                  }
                })
                .catch((err) => console.error(err));
            }}
          >
            Select
          </Button>
        </>
      );
    }
    if (folder.loading) {
      return <Spinner />;
    }
    return <div>??</div>; // should not be possible
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={folder.loading}>
        <div className={styles.toolbar}>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or type" width={50} />
        </div>

        {renderFolder()}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2, isDragActive?: boolean) => ({
  toolbar: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: ${theme.spacing(2)};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
  modalBody: css`
    display: flex;
    flex-direction: row;
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
  iconPreview: css`
    width: 238px;
    height: 198px;
    border: 1px solid ${theme.colors.border.medium};
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  acceptMargin: css`
    margin: ${theme.spacing(2, 0, 1)};
  `,
  small: css`
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(2)};
  `,
  img: css`
    width: 147px;
    height: 147px;
    fill: ${theme.colors.text.primary};
  `,
  button: css`
    margin: 12px 20px 2px;
    float: right;
  `,
});
