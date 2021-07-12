import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { uniqueId } from 'lodash';
import React, { ReactNode, useCallback, useState } from 'react';
import { DropzoneOptions, useDropzone } from 'react-dropzone';
import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FileListItem } from './FileListItem';

export interface DropzoneProps {
  children?: ReactNode;
  options?: DropzoneOptions;
}

export function Dropzone({ options, children }: DropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles, event) => {
      let newFiles = [...files, ...acceptedFiles];
      if (options?.multiple === false) {
        newFiles = acceptedFiles;
      }
      setFiles(newFiles);
      options?.onDrop?.(newFiles, rejectedFiles, event);
    },
    [files, options]
  );

  const removeFile = (file: File) => {
    const newFiles = [...files];
    newFiles.splice(newFiles.indexOf(file), 1);
    setFiles(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ ...options, onDrop });
  const theme = useTheme2();
  const styles = getStyles(theme, isDragActive);
  const fileList = files.map((file) => <FileListItem key={uniqueId()} file={file} removeFile={removeFile} />);

  return (
    <div className={styles.container}>
      <div {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        {children ?? (
          <div className={styles.iconWrapper}>
            <Icon name="upload" size="xxl" />
            <h3>Upload file</h3>
            <small className={styles.small}>
              Drag and drop here or <span className={styles.link}>Browse</span>
            </small>
          </div>
        )}
      </div>
      {fileList}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, isDragActive: boolean) {
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
      border-width: 2px;
      border-style: dashed;
      border-color: ${theme.colors.border.medium};
      background-color: ${isDragActive ? theme.colors.background.secondary : theme.colors.background.primary};
    `,
    iconWrapper: css`
      display: flex;
      flex-direction: column;
      align-items: center;
    `,
    small: css`
      color: ${theme.colors.text.secondary};
    `,
    link: css`
      color: ${theme.colors.text.link};
      cursor: pointer;
    `,
  };
}
