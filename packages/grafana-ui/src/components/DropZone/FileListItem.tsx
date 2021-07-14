import { css } from '@emotion/css';
import { round } from 'lodash';
import React from 'react';
import { GrafanaTheme2 } from '../../../../grafana-data/src';
import { useStyles2 } from '../../themes';
import { formatFileSize, trimFileName } from '../../utils/file';
import { Button } from '../Button';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

export interface FileListItemProps {
  file: File;
  removeFile?: (file: File) => void;
  progress?: number;
  cancelUpload?: () => void;
  error?: string;
}

export function FileListItem({ file, removeFile, progress, cancelUpload, error }: FileListItemProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.fileListContainer}>
      <span className={styles.fileNameWrapper}>
        <Icon name="file-blank" size="lg" />
        <span className={styles.padding}>{trimFileName(file.name)}</span>
        <span>{formatFileSize(file.size)}</span>
      </span>
      {progress && file.size > progress ? (
        <div className={styles.fileNameWrapper}>
          <progress className={styles.progressBar} max={file.size} value={progress} />
          <span className={styles.paddingLeft}>{round(progress / file.size, 2) * 100}%</span>
          <Button variant="secondary" type="button" fill="text" onClick={() => cancelUpload?.()}>
            Cancel
          </Button>
        </div>
      ) : removeFile ? (
        <div className={styles.fileNameWrapper}>
          {error ? <span className={styles.error}>{error}</span> : null}
          <IconButton name="trash-alt" onClick={() => removeFile(file)} tooltip="Remove" />
        </div>
      ) : null}
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
