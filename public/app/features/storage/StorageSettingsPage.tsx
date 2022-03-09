import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Button, InlineField, Input, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { FileBrowser } from './FileBrowser';
import { getIconName } from './StorageList';

export default function StorageSettingsPage() {
  // This should come from an ID selector
  const selectedStorage = useSelector((state: StoreState) => state.storagePageReducers.selectedStorage);
  const [browsePath, setBrowsePath] = useState(selectedStorage?.config.prefix); // TODO? in URL?
  const styles = useStyles2(getStyles);

  if (!selectedStorage) {
    return (
      <div className={styles.noStorage}>
        <h3>No storage selected</h3>
        <Button variant="secondary" fill="solid" type="button" onClick={() => history.back()}>
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
        <FileBrowser prefix="dash" path={browsePath!} onPathChange={setBrowsePath} />

        <div className="gf-form-button-row">
          <Button variant="secondary" fill="solid" type="button" onClick={() => history.back()}>
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
