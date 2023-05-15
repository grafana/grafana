import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { EditDataSourceTitle } from '../components/EditDataSourceTitle';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { useDataSourceSettingsNav } from '../state';

export interface Props {
  uid: string;
  pageId: string | null;
  navId: string;
}

export function DataSourceTabPage({ uid, pageId, navId }: Props) {
  const nav = useDataSourceSettingsNav(uid, pageId);

  const info = useDataSourceInfo({
    dataSourcePluginName: nav.main.dataSourcePluginName,
    alertingSupported: nav.dataSourceHeader.alertingSupported,
  });

  return (
    <Page
      navId={navId}
      pageNav={nav.main}
      renderTitle={(title) => <EditDataSourceTitle title={title} />}
      info={info}
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}

export default DataSourceTabPage;
