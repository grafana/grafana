import React, { FC, FormEvent, useCallback, useState } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { getFormStyles, Icon } from '../index';
import { stylesFactory, useTheme } from '../../themes';
import { ComponentSize } from '../../types/size';

export interface Props {
  /** Callback function to handle uploaded file  */
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
  /** Accepted file extensions */
  accept?: string;
  /** Overwrite or add to style */
  className?: string;
  /** Button size */
  size?: ComponentSize;
}

function trimFileName(fileName: string) {
  const nameLength = 16;
  const delimiter = fileName.lastIndexOf('.');
  const extension = fileName.substring(delimiter);
  const file = fileName.substring(0, delimiter);

  if (file.length < nameLength) {
    return fileName;
  }

  return `${file.substring(0, nameLength)}...${extension}`;
}

export const FileUpload: FC<Props> = ({
  onFileUpload,
  className,
  children = 'Upload file',
  accept = '*',
  size = 'md',
}) => {
  const theme = useTheme();
  const style = getStyles(theme, size);
  const [fileName, setFileName] = useState('');

  const onChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget?.files?.[0];
    if (file) {
      setFileName(file.name ?? '');
    }
    onFileUpload(event);
  }, []);

  return (
    <>
      <label className={cx(style.button, className)}>
        <Icon name="upload" className={style.icon} />
        {children}
        <input
          type="file"
          id="fileUpload"
          className={style.fileUpload}
          onChange={onChange}
          multiple={false}
          accept={accept}
        />
      </label>
      {fileName && (
        <span aria-label="File name" className={style.fileName}>
          {trimFileName(fileName)}
        </span>
      )}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, size: ComponentSize) => {
  const buttonFormStyle = getFormStyles(theme, { variant: 'primary', invalid: false, size }).button.button;
  return {
    fileUpload: css`
      display: none;
    `,
    button: css`
      ${buttonFormStyle}
    `,
    icon: css`
      margin-right: ${theme.spacing.xs};
    `,
    fileName: css`
      margin-left: ${theme.spacing.xs};
    `,
  };
});
