import { DataQuery } from '@grafana/schema';
import { Icon } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { getEditorType } from '../utils';

import { CardTitle } from './CardTitle';
import { SidebarCard } from './SidebarCard';

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { selectedQuery, setSelectedQuery } = useQueryEditorUIContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const isSelected = selectedQuery?.refId === query.refId;

  const isHidden = !!query.hide;

  const item = {
    name: query.refId,
    type: editorType,
    isHidden,
  };

  return (
    <SidebarCard
      id={query.refId}
      isSelected={isSelected}
      item={item}
      onClick={() => setSelectedQuery(query)}
      onDelete={() => deleteQuery(query.refId)}
      onDuplicate={() => duplicateQuery(query.refId)}
      onToggleHide={() => toggleQueryHide(query.refId)}
    >
      {editorType === QueryEditorType.Query && <DataSourceLogo dataSource={queryDsSettings} size={14} />}
      {editorType === QueryEditorType.Expression && (
        <Icon
          name={QUERY_EDITOR_TYPE_CONFIG[editorType].icon}
          color={QUERY_EDITOR_TYPE_CONFIG[editorType].color}
          size="sm"
        />
      )}
      <CardTitle title={query.refId} isHidden={isHidden} />
    </SidebarCard>
  );
};
