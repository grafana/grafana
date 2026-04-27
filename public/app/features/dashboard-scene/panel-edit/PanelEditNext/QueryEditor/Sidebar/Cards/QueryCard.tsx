import { type DataQuery } from '@grafana/schema';
import { Icon } from '@grafana/ui/components/icons';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { type ActionItem } from '../../../Actions';
import { PENDING_CARD_ID, QueryEditorType } from '../../../constants';
import {
  useActionsContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
  useQueryEditorTypeConfig,
} from '../../QueryEditorContext';
import { getEditorType } from '../../utils';

import { CardTitle } from './CardTitle';
import { GhostSidebarCard } from './GhostSidebarCard';
import { SidebarCard } from './SidebarCard';

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const queryDsSettings = useDatasource(query.datasource);
  const { selectedQuery, toggleQuerySelection, selectedQueryRefIds, pendingExpression, pendingSavedQuery } =
    useQueryEditorUIContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const { data } = useQueryRunnerContext();
  const typeConfig = useQueryEditorTypeConfig();

  // Note: when a query is hidden, it is removed from the error list :(
  const error = data?.errors?.find((e) => e.refId === query.refId)?.message;
  const isSelected = selectedQuery?.refId === query.refId;
  const isPartOfSelection = selectedQueryRefIds.includes(query.refId) && !isSelected;
  const isHidden = !!query.hide;

  const item: ActionItem = {
    name: query.refId,
    type: editorType,
    isHidden,
    error,
  };

  return (
    <>
      <SidebarCard
        id={query.refId}
        isSelected={isSelected}
        isPartOfSelection={isPartOfSelection}
        item={item}
        onSelect={(modifiers) => toggleQuerySelection(query, modifiers)}
        onDelete={() => deleteQuery(query.refId)}
        onDuplicate={() => duplicateQuery(query.refId)}
        onToggleHide={() => toggleQueryHide(query.refId)}
      >
        {editorType === QueryEditorType.Query ? (
          <DataSourceLogo dataSource={queryDsSettings} size={14} />
        ) : (
          <Icon name={typeConfig[editorType].icon} color={typeConfig[editorType].color} size="sm" />
        )}
        <CardTitle title={query.refId} isHidden={isHidden} />
      </SidebarCard>
      {pendingExpression?.insertAfter === query.refId && (
        <GhostSidebarCard id={PENDING_CARD_ID.expression} type={QueryEditorType.Expression} />
      )}
      {pendingSavedQuery?.insertAfter === query.refId && (
        <GhostSidebarCard id={PENDING_CARD_ID.savedQuery} type={QueryEditorType.Query} />
      )}
    </>
  );
};
