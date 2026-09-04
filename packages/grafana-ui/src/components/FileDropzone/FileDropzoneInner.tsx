import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';
import {
  type Accept,
  type DropEvent,
  type FileError,
  type FileRejection,
  useDropzone,
  ErrorCode,
} from 'react-dropzone';

import { formattedValueToString, getValueFormat, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { uniqueId } from '../../utils/uniqueId';
import { Alert } from '../Alert/Alert';
import { useFieldContext } from '../Forms/FieldContext';

import {
  type BackwardsCompatibleDropzoneOptions,
  type DropzoneFile,
  type FileDropzoneProps,
  FileDropzoneDefaultChildren,
} from './FileDropzone';
import { FileListItem } from './FileListItem';

export function FileDropzoneInner({
  options,
  children,
  readAs,
  onLoad,
  fileListRenderer,
  onFileRemove,
  id: idProp,
}: FileDropzoneProps) {
  const [files, setFiles] = useState<DropzoneFile[]>([]);
  const [fileErrors, setErrorMessages] = useState<FileError[]>([]);
  const fieldContext = useFieldContext();
  const id = idProp ?? fieldContext.id;

  const formattedSize = getValueFormat('decbytes')(options?.maxSize ? options?.maxSize : 0);

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

      setErrors(rejectedFiles);

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
    onFileRemove?.(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    ...options,
    useFsAccessApi: false,
    onDrop,
    accept: transformAcceptToNewFormat(options?.accept),
  });
  const theme = useTheme2();
  const styles = getStyles(theme, isDragActive);
  const fileList = files.map((file) => {
    if (fileListRenderer) {
      return fileListRenderer(file, removeFile);
    }
    return <FileListItem key={file.id} file={file} removeFile={removeFile} />;
  });

  const setErrors = (rejectedFiles: FileRejection[]) => {
    let errors: FileError[] = [];
    rejectedFiles.map((rejectedFile) => {
      rejectedFile.errors.map((newError) => {
        if (
          errors.findIndex((presentError) => {
            return presentError.code === newError.code && presentError.message === newError.message;
          }) === -1
        ) {
          errors.push(newError);
        }
      });
    });

    setErrorMessages(errors);
  };

  const renderErrorMessages = (errors: FileError[]) => {
    const size = formattedValueToString(formattedSize);
    return (
      <div className={styles.errorAlert}>
        <Alert
          title={t('grafana-ui.file-dropzone.error-title', 'Upload failed')}
          severity="error"
          onRemove={clearAlert}
        >
          {errors.map((error) => {
            switch (error.code) {
              case ErrorCode.FileTooLarge:
                return (
                  <div key={error.message + error.code}>
                    <Trans i18nKey="grafana-ui.file-dropzone.file-too-large">File is larger than {{ size }}</Trans>
                  </div>
                );
              default:
                return <div key={error.message + error.code}>{error.message}</div>;
            }
          })}
        </Alert>
      </div>
    );
  };

  const clearAlert = () => {
    setErrorMessages([]);
  };

  return (
    <div className={styles.container}>
      <div data-testid="dropzone" {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} id={id} />
        {children ?? <FileDropzoneDefaultChildren primaryText={getPrimaryText(files, options)} />}
      </div>
      {fileErrors.length > 0 && renderErrorMessages(fileErrors)}
      <small className={cx(styles.small, styles.acceptContainer)}>
        {options?.maxSize && `Max file size: ${formattedValueToString(formattedSize)}`}
        {options?.maxSize && options?.accept && <span className={styles.acceptSeparator}>{'|'}</span>}
        {options?.accept && getAcceptedFileTypeText(options.accept)}
      </small>
      {fileList}
    </div>
  );
}

function getMimeTypeByExtension(ext: string) {
  if (['txt', 'json', 'csv', 'xls', 'yml'].some((e) => ext.match(e))) {
    return 'text/plain';
  }

  return 'application/octet-stream';
}

function transformAcceptToNewFormat(accept?: string | string[] | Accept): Accept | undefined {
  if (typeof accept === 'string') {
    return {
      [getMimeTypeByExtension(accept)]: [accept],
    };
  }

  if (Array.isArray(accept)) {
    return accept.reduce((prev: Record<string, string[]>, current) => {
      const mime = getMimeTypeByExtension(current);

      prev[mime] = prev[mime] ? [...prev[mime], current] : [current];

      return prev;
    }, {});
  }

  return accept;
}

function getPrimaryText(files: DropzoneFile[], options?: BackwardsCompatibleDropzoneOptions) {
  if (options?.multiple === undefined || options?.multiple) {
    return 'Upload file';
  }
  return files.length ? 'Replace file' : 'Upload file';
}

function getAcceptedFileTypeText(accept: string | string[] | Accept) {
  if (typeof accept === 'string') {
    return `Accepted file type: ${accept}`;
  }

  if (Array.isArray(accept)) {
    return `Accepted file types: ${accept.join(', ')}`;
  }

  // react-dropzone has updated the type of the "accept" parameter since v13.0.0:
  // https://github.com/react-dropzone/react-dropzone/blob/master/src/index.js#L95
  return `Accepted file types: ${Object.values(accept).flat().join(', ')}`;
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
    container: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      border: `1px dashed ${theme.colors.border.strong}`,
      backgroundColor: isDragActive ? theme.colors.background.secondary : theme.colors.background.primary,
      cursor: 'pointer',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    dropzone: css({
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
    small: css({
      color: theme.colors.text.secondary,
    }),
    acceptContainer: css({
      textAlign: 'center',
      margin: 0,
    }),
    acceptSeparator: css({
      margin: `0 ${theme.spacing(1)}`,
    }),
    errorAlert: css({
      paddingTop: '10px',
    }),
  };
}
