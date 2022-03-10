import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Button, InlineField, Input, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation, useParams, useRouteMatch } from 'react-router-dom';
import { useAsync } from 'react-use';
import { FileBrowser } from './FileBrowser';
import { getIconName } from './StorageList';
import { RootStorageMeta, StatusResponse } from './types';

export default function StorageSettingsPage() {
  const { prefix, type } = useParams<{ prefix: string; type: 'dash' | 'res' }>();
  const { search } = useLocation();
  const { url } = useRouteMatch();
  const history = useHistory();
  const path = new URLSearchParams(search).get('path');
  const styles = useStyles2(getStyles);
  const [selectedStorage, setSelectedStorage] = useState<RootStorageMeta>();
  const status = useAsync(async () => {
    return (await getBackendSrv().get('api/storage/status')) as StatusResponse; // observable?
  }, []);

  useEffect(() => {
    if (prefix && type) {
      if (type === 'dash' && status.value?.dashboards.length) {
        const storage = status.value.dashboards.find((x) => x.config.prefix === prefix);
        setSelectedStorage(storage);
      }
      if (type === 'res' && status.value?.resources.length) {
        const storage = status.value.resources.find((x) => x.config.prefix === prefix);
        setSelectedStorage(storage);
      }
    }
  }, [type, prefix, status.value?.dashboards, status.value?.resources]);

  if (status.loading) {
    return null;
  }

  if (!selectedStorage) {
    return (
      <div className={styles.noStorage}>
        <h3>No {type === 'dash' ? 'dashboard' : 'resource'} found</h3>
        <Button variant="secondary" fill="solid" type="button" onClick={() => history.goBack()}>
          Back
        </Button>
      </div>
    );
  }

  const navModel: NavModelItem = {
    id: 'storageSettings',
    text: selectedStorage.config.name,
    subTitle: `Type: ${selectedStorage.config.type}`,
    icon: getIconName(selectedStorage.config.type),
    url: 'org/storage/edit',
    breadcrumbs: [{ title: 'Storage', url: 'org/storage' }],
  };

  return (
    <Page navModel={{ main: navModel, node: navModel }}>
      <Page.Contents>
        <div className="gf-form-group">
          <h3 className="page-heading">General</h3>
          <InlineField label="Name" labelWidth={24}>
            <Input value={selectedStorage.config.name} width={40} />
          </InlineField>
          <InlineField label="Prefix" labelWidth={24}>
            <Input value={selectedStorage.config.prefix} width={40} />
          </InlineField>
        </div>
        {selectedStorage.config.type === 'disk' && (
          <div className="gf-form-group">
            <h3 className="page-heading">Disk settings</h3>
            <InlineField label="Path" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.disk?.path} />
            </InlineField>
          </div>
        )}
        {selectedStorage.config.type === 'git' && (
          <div className="gf-form-group">
            <h3 className="page-heading">Git settings</h3>
            <InlineField label="Root" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.git?.root} />
            </InlineField>
            <InlineField label="Remote" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.git?.remote} />
            </InlineField>
            <InlineField label="Branch" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.git?.branch} />
            </InlineField>
            {/* TODO:// Don't show token */}
            <InlineField label="Access token" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.git?.accessToken} />
            </InlineField>
          </div>
        )}
        {selectedStorage.config.type === 's3' && (
          <div className="gf-form-group">
            <h3 className="page-heading">S3 settings</h3>
            <InlineField label="Bucket" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.s3?.bucket} />
            </InlineField>
            <InlineField label="Folder" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.s3?.folder} />
            </InlineField>
            <InlineField label="Access key" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.s3?.accessKey} />
            </InlineField>
            {/* TODO:// Don't show secret */}
            <InlineField label="Secret key" labelWidth={24}>
              <Input spellCheck={false} width={40} value={selectedStorage.config.s3?.secretKey} />
            </InlineField>
          </div>
        )}
        <FileBrowser
          prefix="dash"
          path={path || selectedStorage.config.prefix}
          onPathChange={(changedPath) => {
            history.push(`${url}?path=${changedPath}`);
          }}
        />

        {selectedStorage.notice?.length && (
          <div className="gf-form-group p-t-2">
            <Alert severity={selectedStorage.notice[0].severity} title={selectedStorage.notice[0].text} />
          </div>
        )}

        <div className="gf-form-button-row">
          <Button variant="secondary" fill="solid" type="button" onClick={() => history.goBack()}>
            Back
          </Button>
          <Button type="button" variant="destructive" onClick={() => console.log('delete')}>
            Delete
          </Button>
          <Button type="submit" variant="primary" onClick={() => console.log('save')}>
            Save
          </Button>
        </div>
      </Page.Contents>
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noStorage: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    `,
  };
}
