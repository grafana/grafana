import React, { FC, FormEvent, useCallback, useRef, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { stylesFactory, useTheme2 } from '../../themes';
import { ComponentSize } from '../../types/size';
import { Button } from '../Button';
import { trimFileName } from '../../utils/file';

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

export const FileUpload: FC<Props> = ({
  onFileUpload,
  className,
  children = 'Upload file',
  accept = '*',
  size = 'md',
}) => {
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const theme = useTheme2();
  const style = getStyles(theme);
  const [fileName, setFileName] = useState('');

  const onChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const file = event.currentTarget?.files?.[0];
      if (file) {
        setFileName(file.name ?? '');
      }
      onFileUpload(event);
    },
    [onFileUpload]
  );

  return (
    <>
      <Button icon="upload" size={size} onClick={() => fileUploadRef.current?.click()}>
        {children}
      </Button>
      <input
        type="file"
        id="fileUpload"
        ref={fileUploadRef}
        className={style.fileUpload}
        onChange={onChange}
        multiple={false}
        accept={accept}
      />
      {fileName && (
        <span aria-label="File name" className={style.fileName}>
          {trimFileName(fileName)}
        </span>
      )}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    fileUpload: css`
      display: none;
    `,
    fileName: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
});
