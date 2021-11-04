import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { uniqueId } from 'lodash';
import React, { ReactNode, useCallback, useState } from 'react';
import { DropEvent, DropzoneOptions, FileRejection, useDropzone } from 'react-dropzone';
import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FileListItem } from './FileListItem';

export interface FileDropzoneProps {
  /**
   * Use the children property to have custom dropzone view.
   */
  children?: ReactNode;
  /**
   * Use this property to override the default behaviour for the react-dropzone options.
   * @default {
   *  maxSize: Infinity,
   *  minSize: 0,
   *  multiple: true,
   *  maxFiles: 0,
   * }
   */
  options?: DropzoneOptions;
  /**
   * Use this to change the FileReader's read.
   */
  readAs?: 'readAsArrayBuffer' | 'readAsText' | 'readAsBinaryString' | 'readAsDataURL';
  /**
   * Use the onLoad function to get the result from FileReader.
   */
  onLoad?: (result: string | ArrayBuffer | null) => void;
  /**
   * The fileListRenderer property can be used to overwrite the list of files. To not to show
   * any list return null in the function.
   */
  fileListRenderer?: (file: DropzoneFile, removeFile: (file: DropzoneFile) => void) => ReactNode;
}

export interface DropzoneFile {
  file: File;
  id: string;
  error: DOMException | null;
  progress?: number;
  abortUpload?: () => void;
  retryUpload?: () => void;
}

export function FileDropzone({ options, children, readAs, onLoad, fileListRenderer }: FileDropzoneProps) {
  const [files, setFiles] = useState<DropzoneFile[]>([]);

  const setFileProperty = useCallback(
    (customFile: DropzoneFile, action: (customFileToModify: DropzoneFile) => void) => {
      setFiles((oldFiles) => {
        return oldFiles.map((oldFile) => {
          if (oldFile.id === customFile.id) {
            action(oldFile);
            return oldFile;
          }
          return oldFile;
        });
      });
    },
    []
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[], event: DropEvent) => {
      let customFiles = acceptedFiles.map(mapToCustomFile);
      if (options?.multiple === false) {
        setFiles(customFiles);
      } else {
        setFiles((oldFiles) => [...oldFiles, ...customFiles]);
      }

      if (options?.onDrop) {
        options.onDrop(acceptedFiles, rejectedFiles, event);
      } else {
        for (const customFile of customFiles) {
          const reader = new FileReader();

          const read = () => {
            if (readAs) {
              reader[readAs](customFile.file);
            } else {
              reader.readAsText(customFile.file);
            }
          };

          // Set abort FileReader
          setFileProperty(customFile, (fileToModify) => {
            fileToModify.abortUpload = () => {
              reader.abort();
            };
            fileToModify.retryUpload = () => {
              setFileProperty(customFile, (fileToModify) => {
                fileToModify.error = null;
                fileToModify.progress = undefined;
              });
              read();
            };
          });

          reader.onabort = () => {
            setFileProperty(customFile, (fileToModify) => {
              fileToModify.error = new DOMException('Aborted');
            });
          };

          reader.onprogress = (event) => {
            setFileProperty(customFile, (fileToModify) => {
              fileToModify.progress = event.loaded;
            });
          };

          reader.onload = () => {
            onLoad?.(reader.result);
          };

          reader.onerror = () => {
            setFileProperty(customFile, (fileToModify) => {
              fileToModify.error = reader.error;
            });
          };

          read();
        }
      }
    },
    [onLoad, options, readAs, setFileProperty]
  );

  const removeFile = (file: DropzoneFile) => {
    const newFiles = files.filter((f) => file.id !== f.id);
    setFiles(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ ...options, onDrop });
  const theme = useTheme2();
  const styles = getStyles(theme, isDragActive);
  const fileList = files.map((file) => {
    if (fileListRenderer) {
      return fileListRenderer(file, removeFile);
    }
    return <FileListItem key={file.id} file={file} removeFile={removeFile} />;
  });

  return (
    <div className={styles.container}>
      <div data-testid="dropzone" {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        {children ?? <FileDropzoneDefaultChildren primaryText={getPrimaryText(files, options)} />}
      </div>
      {options?.accept && (
        <small className={cx(styles.small, styles.acceptMargin)}>{getAcceptedFileTypeText(options)}</small>
      )}
      {fileList}
    </div>
  );
}

export function FileDropzoneDefaultChildren({
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
    </div>
  );
}
function getPrimaryText(files: DropzoneFile[], options?: DropzoneOptions) {
  if (options?.multiple === undefined || options?.multiple) {
    return 'Upload file';
  }
  return files.length ? 'Replace file' : 'Upload file';
}

function getAcceptedFileTypeText(options: DropzoneOptions) {
  if (Array.isArray(options.accept)) {
    return `Accepted file types: ${options.accept.join(', ')}`;
  }

  return `Accepted file type: ${options.accept}`;
}

function mapToCustomFile(file: File): DropzoneFile {
  return {
    id: uniqueId('file'),
    file,
    error: null,
  };
}

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
