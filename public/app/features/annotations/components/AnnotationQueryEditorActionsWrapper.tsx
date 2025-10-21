import { ReactElement } from 'react';

import { AnnotationQuery, CoreApp, DataSourceApi } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { getDataQueryFromAnnotationForSavedQueries } from '../utils/savedQueryUtils';

interface Props {
  children: ReactElement;
  annotation: AnnotationQuery<DataQuery>;
  datasource: DataSourceApi;
  onQueryReplace: (query: DataQuery) => void;
}

export function AnnotationQueryEditorActionsWrapper({ children, annotation, datasource, onQueryReplace }: Props) {
  const { renderSavedQueryButtons } = useQueryLibraryContext();

  const savedQueryButtons = renderSavedQueryButtons(
    getDataQueryFromAnnotationForSavedQueries(annotation, datasource),
    CoreApp.Dashboard,
    undefined,
    onQueryReplace
  );

  return (
    <Stack direction="column" gap={1}>
      <Stack justifyContent="flex-end">{savedQueryButtons}</Stack>
      {children}
    </Stack>
  );
}
