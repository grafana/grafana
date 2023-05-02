import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { EditDataSourceTitle } from '../components/EditDataSourceTitle';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { useDataSourceSettingsNav } from '../state';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function EditDataSourcePage(props: Props) {
  const uid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
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
      navId="datasources"
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

export default EditDataSourcePage;
