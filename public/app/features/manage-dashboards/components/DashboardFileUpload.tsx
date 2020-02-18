import React, { FC, FormEvent } from 'react';
import { Forms, useTheme } from '@grafana/ui';

interface Props {
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
}

export const DashboardFileUpload: FC<Props> = ({ onFileUpload }) => {
  const theme = useTheme();
  const buttonFormStyle = Forms.getFormStyles(theme, { variant: 'primary', invalid: false, size: 'md' }).button.button;

  return (
    <>
      <Forms.Legend>Import via .json file</Forms.Legend>
      <input
        type="file"
        id="fileUpload"
        className="hide"
        onChange={onFileUpload}
        multiple={false}
        accept="application/json"
      />
      <Forms.Label htmlFor="fileUpload" className={buttonFormStyle}>
        Upload .json file
      </Forms.Label>
    </>
  );
};
