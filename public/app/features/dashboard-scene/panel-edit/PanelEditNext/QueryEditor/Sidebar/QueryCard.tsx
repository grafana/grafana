import { DataQuery } from '@grafana/schema';
import { Text } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { getEditorType } from '../utils';

import { SidebarCard } from './SidebarCard';

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { data } = useQueryRunnerContext();
  const { selectedQuery, setSelectedQuery } = useQueryEditorUIContext();

  const hasError = data?.errors?.some((e) => e.refId === query.refId) ?? false;
  const isSelected = selectedQuery?.refId === query.refId;

  return (
    <SidebarCard
      config={QUERY_EDITOR_TYPE_CONFIG[editorType]}
      isSelected={isSelected}
      hasError={hasError}
      id={query.refId}
      onClick={() => setSelectedQuery(query)}
    >
      <DataSourceLogo dataSource={queryDsSettings} />
      <Text weight="light" variant="body" color="secondary">
        {query.refId}
      </Text>
    </SidebarCard>
  );
};
