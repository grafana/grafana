import { css } from '@emotion/css';
import React, { FormEvent, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmModal, FileUpload, useStyles2 } from '@grafana/ui';

import { filenameAlreadyExists, getGrafanaStorage } from './storage';
import { StorageView, UploadReponse } from './types';

interface Props {
  setErrorMessages: (errors: string[]) => void;
  setPath: (p: string, view?: StorageView) => void;
  path: string;
  fileNames: string[];
}

const fileFormats = 'image/jpg, image/jpeg, image/png, image/gif, image/webp';

export function UploadButton({ setErrorMessages, setPath, path, fileNames }: Props) {
  const styles = useStyles2(getStyles);

  const [file, setFile] = useState<File | undefined>(undefined);
  const [filenameExists, setFilenameExists] = useState(false);
  const [fileUploadKey, setFileUploadKey] = useState(1);
  const [isConfirmOpen, setIsConfirmOpen] = useState(true);

  useEffect(() => {
    setFileUploadKey((prev) => prev + 1);
  }, [file]);

  const onUpload = (rsp: UploadReponse) => {
    console.log('Uploaded: ' + path);
    if (rsp.path) {
      setPath(rsp.path);
    } else {
      setPath(path); // back to data
    }
  };

  const doUpload = async (fileToUpload: File, overwriteExistingFile: boolean) => {
    if (!fileToUpload) {
      setErrorMessages(['Please select a file.']);
      return;
    }

    const rsp = await getGrafanaStorage().upload(path, fileToUpload, overwriteExistingFile);
    if (rsp.status !== 200) {
      setErrorMessages([rsp.message]);
    } else {
      onUpload(rsp);
    }
  };

  const onFileUpload = (event: FormEvent<HTMLInputElement>) => {
    setErrorMessages([]);

    const fileToUpload =
      event.currentTarget.files && event.currentTarget.files.length > 0 && event.currentTarget.files[0]
        ? event.currentTarget.files[0]
        : undefined;
    if (fileToUpload) {
      setFile(fileToUpload);

      const fileExists = filenameAlreadyExists(fileToUpload.name, fileNames);
      if (!fileExists) {
        setFilenameExists(false);
        doUpload(fileToUpload, false).then((r) => {});
      } else {
        setFilenameExists(true);
        setIsConfirmOpen(true);
      }
    }
  };

  const onOverwriteConfirm = () => {
    if (file) {
      doUpload(file, true).then((r) => {});
      setIsConfirmOpen(false);
    }
  };

  const onOverwriteDismiss = () => {
    setFile(undefined);
    setFilenameExists(false);
    setIsConfirmOpen(false);
  };

  return (
    <>
      <FileUpload accept={fileFormats} onFileUpload={onFileUpload} key={fileUploadKey} className={styles.uploadButton}>
        Upload
      </FileUpload>

      {file && filenameExists && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          body={
            <div>
              <p>{file?.name}</p>
              <p>A file with this name already exists.</p>
              <p>What would you like to do?</p>
            </div>
          }
          title={'This file already exists'}
          confirmText={'Replace'}
          onConfirm={onOverwriteConfirm}
          onDismiss={onOverwriteDismiss}
        />
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  uploadButton: css`
    margin-right: ${theme.spacing(2)};
  `,
});
