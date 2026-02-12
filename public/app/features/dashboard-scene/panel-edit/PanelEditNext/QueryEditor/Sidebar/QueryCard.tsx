import { DataQuery } from '@grafana/schema';
import { Text } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { QUERY_EDITOR_TYPE_CONFIG } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { getEditorType } from '../utils';

import { SidebarCard } from './SidebarCard';

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { selectedQuery, setSelectedQuery } = useQueryEditorUIContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const isSelected = selectedQuery?.refId === query.refId;

  const item = {
    name: query.refId,
    type: editorType,
    isHidden: !!query.hide,
  };

  return (
    <SidebarCard
      config={QUERY_EDITOR_TYPE_CONFIG[editorType]}
      id={query.refId}
      isSelected={isSelected}
      item={item}
      onClick={() => setSelectedQuery(query)}
      onDelete={() => deleteQuery(query.refId)}
      onDuplicate={() => duplicateQuery(query.refId)}
      onToggleHide={() => toggleQueryHide(query.refId)}
      showAddButton={true}
    >
      <DataSourceLogo dataSource={queryDsSettings} />
      <Text weight="light" variant="code" color="secondary">
        {query.refId}
      </Text>
    </SidebarCard>
  );
};
