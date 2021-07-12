import { css } from '@emotion/css';
import React from 'react';
import { GrafanaTheme2 } from '../../../../grafana-data/src';
import { useStyles2 } from '../../themes';
import { formatFileSize, trimFileName } from '../../utils/file';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

interface Props {
  file: File;
  removeFile: (file: File) => void;
}

export function FileListItem({ file, removeFile }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.fileListContainer}>
      <span className={styles.fileName}>
        <Icon name="file-blank" size="lg" />
        <span className={styles.padding}>{trimFileName(file.name)}</span>
        <span>{formatFileSize(file.size)}</span>
      </span>
      <IconButton name="trash-alt" onClick={() => removeFile(file)} tooltip="Remove" />
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
    fileName: css`
      display: flex;
      flex-direction: row;
      align-items: center;
    `,
    padding: css`
      padding: ${theme.spacing(0, 1)};
    `,
  };
}
