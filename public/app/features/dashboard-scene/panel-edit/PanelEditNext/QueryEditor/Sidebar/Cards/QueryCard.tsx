import { type DataQuery } from '@grafana/schema';
import { Icon } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';
import { useDatasource } from 'app/features/datasources/hooks';

import { queryToActionItem } from '../../../actionItem';
import { PENDING_CARD_ID, QueryEditorType } from '../../../constants';
import {
  useActionsContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
  useQueryEditorTypeConfig,
} from '../../QueryEditorContext';
import { usePanelScopedVars } from '../../hooks/usePanelScopedVars';
import { getEditorType } from '../../utils';

import { CardTitle } from './CardTitle';
import { GhostSidebarCard } from './GhostSidebarCard';
import { SidebarCard } from './SidebarCard';

export const QueryCard = ({ query }: { query: DataQuery }) => {
  const editorType = getEditorType(query);
  const scopedVars = usePanelScopedVars();
  const queryDsSettings = useDatasource(query.datasource, scopedVars);
  const {
    selectedQuery,
    setSelectedQuery,
    toggleQuerySelection,
    selectedQueryRefIds,
    multiSelectMode,
    pendingExpression,
    pendingSavedQuery,
  } = useQueryEditorUIContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide } = useActionsContext();
  const { data } = useQueryRunnerContext();
  const typeConfig = useQueryEditorTypeConfig();

  const error = data?.errors?.find((e) => e.refId === query.refId)?.message;
  const isSelected = selectedQuery?.refId === query.refId;
  const isMultiSelected = multiSelectMode && selectedQueryRefIds.includes(query.refId);
  const isHidden = !!query.hide;

  const item = queryToActionItem(query, { error });

  return (
    <>
      <SidebarCard
        id={query.refId}
        isSelected={isSelected}
        isMultiSelected={isMultiSelected}
        item={item}
        onSelect={() => setSelectedQuery(query)}
        onToggleMultiSelect={(modifiers) => toggleQuerySelection(query, modifiers)}
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
