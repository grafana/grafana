import React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import DataSourceTabPage from '../components/DataSourceTabPage';
import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceSettingsNav } from '../state';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function EditDataSourcePage(props: Props) {
  const uid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
  const pageId = params.get('page');
  const dataSourcePageHeader = config.featureToggles.dataSourcePageHeader;
  const nav = useDataSourceSettingsNav(uid, pageId);

  if (dataSourcePageHeader) {
    return <DataSourceTabPage uid={uid} pageId={pageId} navId="datasources" />;
  }

  return (
    <Page navId="datasources" pageNav={nav.main} actions={<EditDataSourceActions uid={uid} />}>
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}

export default EditDataSourcePage;
