import React, { useState, useEffect } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { InlineField, Input, useStyles, Button, Form, Alert } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { PasswordField } from '../../../core/components/PasswordField/PasswordField';

interface CloudAdminAsFormDTO {
  url: string;
  username: string;
  password: string;
}
export default function CloudAdminPage() {
  const navModel = useNavModel('live-cloud');
  const styles = useStyles(getStyles);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  // useEffect(() => {
  //   getBackendSrv()
  //     .get(`api/live/remote-write-backends`)
  //     .then((data) => {
  //       setCloud(data.remoteWriteBackends);
  //     })
  //     .catch((e) => {
  //       if (e.data) {
  //         setError(JSON.stringify(e.data, null, 2));
  //       }
  //     });
  // }, []);
  const onSubmit = (formData: CloudAdminAsFormDTO) => {
    getBackendSrv()
      .request({
        method: 'GET',
        url: `${formData.url}`,
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${formData.username} + ':' + ${formData.password}`, 'binary').toString('base64'),
        },
      })
      .then((data) => setSuccess(true))
      .catch(() => setError(true));
  };
  const defaultValues: CloudAdminAsFormDTO = {
    url: 'https://prometheus-prod-10-prod-us-central-0.grafana.net',
    username: '211559',
    password: 'eyJrIjoiYWU3ZjEzM2U2N2ZmYWY0MDNkZDgyNzE2ZWUzNjgyMmVkMWNlYzRhZSIsIm4iOiJoZWxsbyIsImlkIjo1NDUzNDN9',
  };
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {success && <Alert title="Successful authentication" severity="info" />}
        {error && <Alert title="Failed authentication" severity="error" />}
        <Form defaultValues={defaultValues} onSubmit={onSubmit}>
          {({ errors, register, getValues }) => (
            <>
              <InlineField label="Remote Write Url">
                <Input placeholder="https://..." {...register('url')}></Input>
              </InlineField>
              <InlineField label="Username">
                <Input {...register('username')}></Input>
              </InlineField>
              <InlineField label="Password">
                <PasswordField
                  id="current-password"
                  autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                />
              </InlineField>
              <Button className={styles.testButton}>Test</Button>
            </>
          )}
        </Form>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    testButton: css`
      margin-top: 5px;
    `,
  };
};
