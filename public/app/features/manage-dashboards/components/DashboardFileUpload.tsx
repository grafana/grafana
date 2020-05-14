import React, { FC, FormEvent } from 'react';
import { getFormStyles, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
}

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

export const DashboardFileUpload: FC<Props> = ({ onFileUpload }) => {
  const theme = useTheme();
  const style = getStyles(theme);

  return (
    <label className={style.button}>
      Upload .json file
      <input
        type="file"
        id="fileUpload"
        className={style.fileUpload}
        onChange={onFileUpload}
        multiple={false}
        accept="application/json"
      />
    </label>
  );
};
