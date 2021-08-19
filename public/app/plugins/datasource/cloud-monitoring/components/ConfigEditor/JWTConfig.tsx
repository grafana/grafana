import React, { FormEvent, useState } from 'react';
import { startCase } from 'lodash';
import { Button, FileUpload, InlineField, Input, useStyles, Alert } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

const configKeys = ['project_id', 'private_key', 'client_email', 'token_uri'];

export interface JWT {
  token_uri: string;
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface Props {
  onChange: (jwt: JWT) => void;
  isConfigured: boolean;
}

const validateJson = (json: JWT): json is JWT => {
  return !!json.token_uri && !!json.client_email && !!json.project_id && !!json.project_id;
};

export function JWTConfig({ onChange, isConfigured }: Props) {
  const styles = useStyles(getStyles);
  const [enableUpload, setEnableUpload] = useState<boolean>(!isConfigured);
  const [error, setError] = useState<string | null>(null);

  return enableUpload ? (
    <>
      <FileUpload
        className={styles}
        accept="application/json"
        onFileUpload={(event: FormEvent<HTMLInputElement>) => {
          if (event?.currentTarget?.files?.length === 1) {
            setError(null);
            const reader = new FileReader();
            const readerOnLoad = () => {
              return (e: any) => {
                const json = JSON.parse(e.target.result);
                if (validateJson(json)) {
                  onChange(json);
                  setEnableUpload(false);
                } else {
                  setError('Invalid JWT file');
                }
              };
            };
            reader.onload = readerOnLoad();
            reader.readAsText(event.currentTarget.files[0]);
          } else {
            setError('You can only upload one file');
          }
        }}
      >
        Upload service account key file
      </FileUpload>

      {error && <p className={cx(styles, 'alert')}>{error}</p>}
    </>
  ) : (
    <>
      {configKeys.map((key, i) => (
        <InlineField label={startCase(key)} key={i} labelWidth={20} disabled>
          <Input width={40} placeholder="configured" />
        </InlineField>
      ))}
      <Button variant="secondary" onClick={() => setEnableUpload(true)} className={styles}>
        Upload another JWT file
      </Button>

      <Alert title="" className={styles} severity="info">
        Do not forget to save your changes after uploading a file
      </Alert>
    </>
  );
}

export const getStyles = (theme: GrafanaTheme) => css`
  margin: ${theme.spacing.md} 0 0;
`;
