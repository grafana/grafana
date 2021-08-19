import React, { FC, FormEvent, useCallback, useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { Icon } from '../index';
import { stylesFactory, useTheme2 } from '../../themes';
import { ComponentSize } from '../../types/size';
import { getButtonStyles } from '../Button';
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
  const theme = useTheme2();
  const style = getStyles(theme, size);
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

const getStyles = stylesFactory((theme: GrafanaTheme2, size: ComponentSize) => {
  const buttonStyles = getButtonStyles({ theme, variant: 'primary', size, iconOnly: false });
  return {
    fileUpload: css`
      display: none;
    `,
    button: buttonStyles.button,
    icon: buttonStyles.icon,
    fileName: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
});
