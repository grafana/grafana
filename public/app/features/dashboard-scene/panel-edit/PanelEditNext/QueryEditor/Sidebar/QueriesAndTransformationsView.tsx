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
import { SectionEmptyState } from './SectionEmptyState';

export function QueriesAndTransformationsView() {
  const { queries } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { pendingExpression, pendingSavedQuery, pendingTransformation } = useQueryEditorUIContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  const [queriesOpen, setQueriesOpen] = useState(true);
  const [transformationsOpen, setTransformationsOpen] = useState(true);

  const expandQueries = useCallback(() => setQueriesOpen(true), []);
  const expandTransformations = useCallback(() => setTransformationsOpen(true), []);

  // A pending card renders a ghost placeholder in the section, so the section isn't truly empty
  // while one is being added.
  const showExpressionGhost = !!pendingExpression && !pendingExpression.insertAfter;
  const showSavedQueryGhost = !!pendingSavedQuery && !pendingSavedQuery.insertAfter;
  const showTransformationGhost = !!pendingTransformation && !pendingTransformation.insertAfter;

  const isQueriesEmpty = queries.length === 0 && !showExpressionGhost && !showSavedQueryGhost;
  const isTransformationsEmpty = transformations.length === 0 && !showTransformationGhost;

  return (
    <>
      <CollapsableSection
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
        isOpen={queriesOpen}
        onToggle={setQueriesOpen}
        headerAction={<AddCardButton variant="query" alwaysVisible onAdd={expandQueries} />}
      >
        {queries.length > 0 && (
          <DraggableList
            droppableId="query-sidebar-queries"
            items={queries}
            keyExtractor={(query) => query.refId}
            renderItem={(query) => <QueryCard query={query} />}
            onDragEnd={onQueryDragEnd}
          />
        )}
        {showExpressionGhost && <GhostSidebarCard id={PENDING_CARD_ID.expression} type={QueryEditorType.Expression} />}
        {showSavedQueryGhost && <GhostSidebarCard id={PENDING_CARD_ID.savedQuery} type={QueryEditorType.Query} />}
        {isQueriesEmpty && (
          <SectionEmptyState message={t('query-editor-next.sidebar.queries-empty', 'No queries or expressions')} />
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
        {showTransformationGhost && (
          <GhostSidebarCard id={PENDING_CARD_ID.transformation} type={QueryEditorType.Transformation} />
        )}
        {isTransformationsEmpty && (
          <SectionEmptyState message={t('query-editor-next.sidebar.transformations-empty', 'No transformations')} />
        )}
      </CollapsableSection>
    </>
  );
}
