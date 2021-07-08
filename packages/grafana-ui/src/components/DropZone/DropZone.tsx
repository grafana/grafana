import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import React, { ReactNode } from 'react';
import { DropzoneOptions, useDropzone } from 'react-dropzone';
import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';

export interface DropzoneProps {
  children?: ReactNode;
  options?: DropzoneOptions;
}

export function Dropzone({ options, children }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone(options);
  const theme = useTheme2();
  const styles = getStyles(theme, isDragActive);

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
      padding: ${theme.spacing(10)};
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
