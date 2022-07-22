import { css } from '@emotion/css';
import React from 'react';

import { formattedValueToString, getValueFormat, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { trimFileName } from '../../utils/file';
import { Button } from '../Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

import { DropzoneFile } from './FileDropzone';

export const REMOVE_FILE = 'Remove file';
export interface FileListItemProps {
  file: DropzoneFile;
  removeFile?: (file: DropzoneFile) => void;
}

export function FileListItem({ file: customFile, removeFile }: FileListItemProps) {
  const styles = useStyles2(getStyles);
  const { file, progress, error, abortUpload, retryUpload } = customFile;

  const renderRightSide = () => {
    if (error) {
      return (
        <>
          <span className={styles.error}>{error.message}</span>
          {retryUpload && (
            <IconButton
              type="button"
              aria-label="Retry"
              name="sync"
              tooltip="Retry"
              tooltipPlacement="top"
              onClick={retryUpload}
            />
          )}
          {removeFile && (
            <IconButton
              className={retryUpload ? styles.marginLeft : ''}
              type="button"
              name="trash-alt"
              onClick={() => removeFile(customFile)}
              tooltip={REMOVE_FILE}
              aria-label={REMOVE_FILE}
            />
          )}
        </>
      );
    }

    if (progress && file.size > progress) {
      return (
        <>
          <progress className={styles.progressBar} max={file.size} value={progress} />
          <span className={styles.paddingLeft}>{Math.round((progress / file.size) * 100)}%</span>
          {abortUpload && (
            <Button variant="secondary" type="button" fill="text" onClick={abortUpload}>
              Cancel upload
            </Button>
          )}
        </>
      );
    }
    return (
      removeFile && (
        <IconButton
          name="trash-alt"
          onClick={() => removeFile(customFile)}
          tooltip={REMOVE_FILE}
          aria-label={REMOVE_FILE}
          type="button"
          tooltipPlacement="top"
        />
      )
    );
  };

  const valueFormat = getValueFormat('decbytes')(file.size);

  return (
    <div className={styles.fileListContainer}>
      <span className={styles.fileNameWrapper}>
        <Icon name="file-blank" size="lg" aria-hidden={true} />
        <span className={styles.padding}>{trimFileName(file.name)}</span>
        <span>{formattedValueToString(valueFormat)}</span>
      </span>

      <div className={styles.fileNameWrapper}>{renderRightSide()}</div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    fileListContainer: css`
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(2)};
      border: 1px dashed ${theme.colors.border.medium};
      background-color: ${theme.colors.background.secondary};
      margin-top: ${theme.spacing(1)};
    `,
    fileNameWrapper: css`
      display: flex;
      flex-direction: row;
      align-items: center;
    `,
    padding: css`
      padding: ${theme.spacing(0, 1)};
    `,
    paddingLeft: css`
      padding-left: ${theme.spacing(2)};
    `,
    marginLeft: css`
      margin-left: ${theme.spacing(1)};
    `,
    error: css`
      padding-right: ${theme.spacing(2)};
      color: ${theme.colors.error.text};
    `,
    progressBar: css`
      border-radius: ${theme.spacing(1)};
      height: 4px;
      ::-webkit-progress-bar {
        background-color: ${theme.colors.border.weak};
        border-radius: ${theme.spacing(1)};
      }
      ::-webkit-progress-value {
        background-color: ${theme.colors.primary.main};
        border-radius: ${theme.spacing(1)};
      }
    `,
  };
}
