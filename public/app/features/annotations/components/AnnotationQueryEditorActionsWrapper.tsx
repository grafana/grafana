import { type ReactElement } from 'react';

import type { AnnotationQuery, DataSourceApi } from '@grafana/data/types';
import { type DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { getDataQueryFromAnnotationForSavedQueries } from '../utils/savedQueryUtils';

interface Props {
  children: ReactElement;
  annotation: AnnotationQuery<DataQuery>;
  datasource: DataSourceApi;
  onQueryReplace: (query: DataQuery) => void;
  disableSavedQueries?: boolean;
}

export function AnnotationQueryEditorActionsWrapper({
  children,
  annotation,
  datasource,
  onQueryReplace,
  disableSavedQueries,
}: Props) {
  const { renderSavedQueryButtons } = useQueryLibraryContext();

  const savedQueryButtons = disableSavedQueries
    ? undefined
    : renderSavedQueryButtons(
        getDataQueryFromAnnotationForSavedQueries(annotation, datasource),
        'dashboard-annotations',
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
