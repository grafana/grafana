import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';

import { PENDING_CARD_ID, QueryEditorType } from '../../constants';
import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AddCardButton } from './AddCardButton';
import { GhostSidebarCard } from './Cards/GhostSidebarCard';
import { QueryCard } from './Cards/QueryCard';
import { TransformationCard } from './Cards/TransformationCard';
import { CollapsableSection } from './CollapsableSection';
import { DraggableList } from './DraggableList/DraggableList';
import { useSidebarDragAndDrop } from './DraggableList/useSidebarDragAndDrop';

export function QueriesAndTransformationsView() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { pendingExpression, pendingSavedQuery, pendingTransformation } = useQueryEditorUIContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  const [queriesOpen, setQueriesOpen] = useState(true);
  const [transformationsOpen, setTransformationsOpen] = useState(true);

  const expandQueries = useCallback(() => setQueriesOpen(true), []);
  const expandTransformations = useCallback(() => setTransformationsOpen(true), []);

  return (
    <>
      <CollapsableSection
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
        isOpen={queriesOpen}
        onToggle={setQueriesOpen}
        headerAction={<AddCardButton variant="query" alwaysVisible onAdd={expandQueries} />}
      >
        <DraggableList
          droppableId="query-sidebar-queries"
          items={queries}
          keyExtractor={(query) => query.refId}
          renderItem={(query) => <QueryCard query={query} />}
          onDragEnd={onQueryDragEnd}
        />
        {pendingExpression && !pendingExpression.insertAfter && (
          <GhostSidebarCard id={PENDING_CARD_ID.expression} type={QueryEditorType.Expression} />
        )}
        {pendingSavedQuery && !pendingSavedQuery.insertAfter && (
          <GhostSidebarCard id={PENDING_CARD_ID.savedQuery} type={QueryEditorType.Query} />
        )}
      </CollapsableSection>
      <CollapsableSection
        label={t('query-editor-next.sidebar.transformations', 'Transformations')}
        isOpen={transformationsOpen}
        onToggle={setTransformationsOpen}
        headerAction={<AddCardButton variant="transformation" alwaysVisible onAdd={expandTransformations} />}
      >
        {transformations.length > 0 && (
          <DraggableList
            droppableId="query-sidebar-transformations"
            items={transformations}
            keyExtractor={(t) => t.transformId}
            renderItem={(t) => <TransformationCard transformation={t} />}
            onDragEnd={onTransformationDragEnd}
          />
        )}
        {pendingTransformation && !pendingTransformation.insertAfter && (
          <GhostSidebarCard id={PENDING_CARD_ID.transformation} type={QueryEditorType.Transformation} />
        )}
      </CollapsableSection>
    </>
  );
}
