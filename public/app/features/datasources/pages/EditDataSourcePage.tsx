import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { EditDataSource } from '../components/EditDataSource';
import { useDataSourceSettingsNav } from '../state';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function EditDataSourcePage(props: Props): React.ReactElement {
  const dataSourceUid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
  const pageId = params.get('page');
  const nav = useDataSourceSettingsNav(dataSourceUid, pageId);

  return (
    <Page navModel={nav}>
      <Page.Contents>
        <EditDataSource id={dataSourceUid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}

export default EditDataSourcePage;
