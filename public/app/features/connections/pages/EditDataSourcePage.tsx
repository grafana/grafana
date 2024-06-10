import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import DataSourceTabPage from 'app/features/datasources/components/DataSourceTabPage';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');

  return <DataSourceTabPage uid={uid} pageId={pageId} />;
}
