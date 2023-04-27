import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { EditDataSourceTitle } from 'app/features/datasources/components/EditDataSourceTitle';
import { EditDataSourceSubtitle } from 'app/features/datasources/components/EditDatasSourceSubtitle';
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
      renderTitle={(title) => <EditDataSourceTitle title={title} onNameChange={nav.props.onNameChange} />}
      subTitle={
        <EditDataSourceSubtitle
          dataSourcePluginName={nav.main.dataSourcePluginName}
          isDefault={nav.props.isDefault || false}
          alertingSupported={nav.props.alertingSupported}
          onDefaultChange={nav.props.onDefaultChange}
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
