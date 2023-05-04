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
    dataSource: nav.dataSource,
    dataSourcePluginName: nav.main.dataSourcePluginName,
    isDefault: nav.dataSource.isDefault,
    alertingSupported: nav.dataSourceHeader.alertingSupported,
    onUpdate: nav.dataSourceHeader.onUpdate,
  });

  return (
    <Page
      navId={navId}
      pageNav={nav.main}
      renderTitle={(title) => (
        <EditDataSourceTitle
          dataSource={nav.dataSource}
          title={title}
          readOnly={nav.dataSource.readOnly}
          onUpdate={nav.dataSourceHeader.onUpdate}
        />
      )}
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
