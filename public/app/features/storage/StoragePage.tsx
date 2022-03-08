import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { getBackendSrv } from '@grafana/runtime';
import { FilterInput, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';
import { Button } from './Button';
import { StorageList } from './StorageList';
import { StatusResponse, RootStorageMeta } from './types';

export default function StoragePage() {
  const styles = useStyles2(getStyles);
  const navModel = useSelector((state: StoreState) => getNavModel(state.navIndex, 'storage'));
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboards, setDashboards] = useState<RootStorageMeta[]>();
  const [resources, setResources] = useState<RootStorageMeta[]>();

  const status = useAsync(async () => {
    return (await getBackendSrv().get('api/storage/status')) as StatusResponse; // observable?
  }, []);

  useEffect(() => {
    const regex = new RegExp(searchQuery, 'i');
    if (status.value?.dashboards.length) {
      const filteredDashboard = status.value.dashboards.filter(filterByName(regex));
      setDashboards(filteredDashboard);
    }
    if (status.value?.resources.length) {
      const filteredResources = status.value.resources.filter(filterByName(regex));
      setResources(filteredResources);
    }
  }, [searchQuery, status.value?.dashboards, status.value?.resources]);

  const doExport = useCallback(() => {
    getBackendSrv()
      .post('api/storage/export')
      .then((v) => {
        alert(JSON.stringify(v));
      });
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div className={styles.toolbar}>
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or type" width={50} />
          <Stack direction="row" gap={2}>
            <Button
              buttonProps={{ variant: 'primary', icon: 'plus', children: 'Add storage' }}
              options={[
                { value: 'sql', label: 'SQL (Grafana default)' },
                { value: 'localfs', label: 'Local file system' },
                { value: 'git', label: 'Git' },
              ]}
              onChange={function (value: SelectableValue<string>): void {
                //TODO: add storage
                console.log(value);
              }}
            />
            <Button
              buttonProps={{ variant: 'secondary', children: 'Actions', icon: '' }}
              options={[
                { value: 'push', label: 'Push storage to git', icon: 'arrow-up' },
                { value: 'pull', label: 'Pull storage from git', icon: 'arrow-down' },
              ]}
              onChange={function (value: SelectableValue<string>): void {
                if (value.value === 'push') {
                  doExport();
                }
              }}
            />
          </Stack>
        </div>
        {dashboards && (
          <div className={styles.border}>
            <StorageList storage={dashboards} title="Dashboards" />
          </div>
        )}
        {status.value?.datasources?.length && (
          <div className={styles.border}>
            <StorageList storage={status.value.datasources} title="Data sources" />
          </div>
        )}
        {resources && (
          <div className={styles.border}>
            <StorageList storage={resources} title="Resources" />
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: ${theme.spacing(2)};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
});

const filterByName = (regex: RegExp) => (storage: RootStorageMeta) => regex.test(storage.config.name);
