import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { EditDataSourceSubtitle } from 'app/features/datasources/components/EditDataSourceSubtitle';
import { EditDataSourceTitle } from 'app/features/datasources/components/EditDataSourceTitle';
import { useDataSourceSettingsNav } from 'app/features/datasources/state';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');
  const nav = useDataSourceSettingsNav(uid, pageId);

  return (
    <Page
      navId="connections-your-connections-datasources"
      pageNav={nav.main}
      renderTitle={(title) => (
        <EditDataSourceTitle
          title={title}
          readOnly={nav.dataSource.isReadOnly}
          onNameChange={nav.dataSource.onNameChange}
        />
      )}
      subTitle={
        <EditDataSourceSubtitle
          dataSourcePluginName={nav.main.dataSourcePluginName}
          isDefault={nav.dataSource.isDefault || false}
          alertingSupported={nav.dataSource.alertingSupported}
          onDefaultChange={nav.dataSource.onDefaultChange}
        />
      }
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
