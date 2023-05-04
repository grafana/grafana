import React from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import DataSourceTabPage from '../components/DataSourceTabPage';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function EditDataSourcePage(props: Props) {
  const uid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
  const pageId = params.get('page');

  return <DataSourceTabPage uid={uid} pageId={pageId} navId="datasources" />;
}

export default EditDataSourcePage;
