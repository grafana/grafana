import React, { FC, FormEvent } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { getFormStyles } from '../index';
import { stylesFactory, useTheme } from '../../themes';

export interface Props {
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
  label?: string;
  accept?: string;
}

export const FileUpload: FC<Props> = ({ onFileUpload, label = 'Upload file', accept = '*' }) => {
  const theme = useTheme();
  const style = getStyles(theme);

  return (
    <label className={style.button}>
      {label}
      <input
        type="file"
        id="fileUpload"
        className={style.fileUpload}
        onChange={onFileUpload}
        multiple={false}
        accept={accept}
      />
    </label>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const buttonFormStyle = getFormStyles(theme, { variant: 'primary', invalid: false, size: 'md' }).button.button;
  return {
    fileUpload: css`
      display: none;
    `,
    button: css`
      ${buttonFormStyle}
    `,
  };
});
