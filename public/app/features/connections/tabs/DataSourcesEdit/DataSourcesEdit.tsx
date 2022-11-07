import React from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function DataSourcesEdit(props: Props) {
  const uid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
  const pageId = params.get('page');

  return <EditDataSource uid={uid} pageId={pageId} />;
}
