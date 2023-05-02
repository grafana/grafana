import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { EditDataSourceTitle } from 'app/features/datasources/components/EditDataSourceTitle';
import { useDataSourceInfo } from 'app/features/datasources/components/useDataSourceInfo';
import { useDataSourceSettingsNav } from 'app/features/datasources/state';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');
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
      navId="connections-your-connections-datasources"
      pageNav={nav.main}
      renderTitle={(title) => (
        <EditDataSourceTitle
          dataSource={nav.dataSource}
          title={title}
          readOnly={nav.dataSource.readOnly}
          onUpdate={nav.dataSourceHeader.onUpdate}
        />
      )}
      subTitle={<></>}
      info={info}
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
