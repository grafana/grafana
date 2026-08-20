import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';

import { PENDING_CARD_ID, QueryEditorType } from '../../constants';
import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AddCardButton } from './AddCardButton';
import { GhostSidebarCard } from './Cards/GhostSidebarCard';
import { QueryCard } from './Cards/QueryCard';
import { SystemTransformationCards } from './Cards/SystemTransformationCards';
import { TransformationCard } from './Cards/TransformationCard';
import { CollapsableSection } from './CollapsableSection';
import { DraggableList } from './DraggableList/DraggableList';
import { useSidebarDragAndDrop } from './DraggableList/useSidebarDragAndDrop';
import { SectionEmptyState } from './SectionEmptyState';

interface QueriesAndTransformationsViewProps {
  showButtonLabels?: boolean;
}

export function QueriesAndTransformationsView({ showButtonLabels = false }: QueriesAndTransformationsViewProps) {
  const { queries } = useQueryRunnerContext();
  const { transformations, systemTransformations } = usePanelContext();
  const { pendingExpression, pendingSavedQuery, pendingTransformation, multiSelectMode } = useQueryEditorUIContext();
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

  // Only surface the per-section placeholders when the whole panel is empty. Showing "No
  // transformations yet" on every panel that simply hasn't added a transformation (the common
  // case) would be noise.
  const isPanelEmpty = queries.length === 0 && transformations.length === 0;
  const showQueriesEmptyState = isPanelEmpty && !showExpressionGhost && !showSavedQueryGhost;
  // Scoped to this section rather than folded into `isPanelEmpty`: the plugin's transformations are
  // content here — the section is showing rows, so "No transformations" would contradict what is on
  // screen — but they say nothing about whether the panel has queries.
  const hasSystemTransformations = systemTransformations.prepend.length > 0 || systemTransformations.append.length > 0;
  const showTransformationsEmptyState = isPanelEmpty && !showTransformationGhost && !hasSystemTransformations;

  return (
    <>
      <CollapsableSection
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
        isOpen={queriesOpen}
        onToggle={setQueriesOpen}
        headerAction={
          <AddCardButton variant="query" alwaysVisible showLabel={showButtonLabels} onAdd={expandQueries} />
        }
      >
        {queries.length > 0 && (
          <DraggableList
            isDragDisabled={multiSelectMode}
            droppableId="query-sidebar-queries"
            items={queries}
            keyExtractor={(query) => query.refId}
            renderItem={(query) => <QueryCard query={query} />}
            onDragEnd={onQueryDragEnd}
          />
        )}
        {showExpressionGhost && <GhostSidebarCard id={PENDING_CARD_ID.expression} type={QueryEditorType.Expression} />}
        {showSavedQueryGhost && <GhostSidebarCard id={PENDING_CARD_ID.savedQuery} type={QueryEditorType.Query} />}
        {showQueriesEmptyState && (
          <SectionEmptyState message={t('query-editor-next.sidebar.queries-empty', 'No queries or expressions')} />
        )}
      </CollapsableSection>
      <CollapsableSection
        label={t('query-editor-next.sidebar.transformations', 'Transformations')}
        isOpen={transformationsOpen}
        onToggle={setTransformationsOpen}
        headerAction={
          <AddCardButton
            variant="transformation"
            alwaysVisible
            showLabel={showButtonLabels}
            onAdd={expandTransformations}
          />
        }
      >
        <SystemTransformationCards transformations={systemTransformations.prepend} position="prepend" />
        {transformations.length > 0 && (
          <DraggableList
            isDragDisabled={multiSelectMode}
            droppableId="query-sidebar-transformations"
            items={transformations}
            keyExtractor={(t) => t.transformId}
            renderItem={(t) => <TransformationCard transformation={t} />}
            onDragEnd={onTransformationDragEnd}
          />
        )}
        <SystemTransformationCards transformations={systemTransformations.append} position="append" />
        {showTransformationGhost && (
          <GhostSidebarCard id={PENDING_CARD_ID.transformation} type={QueryEditorType.Transformation} />
        )}
        {showTransformationsEmptyState && (
          <SectionEmptyState message={t('query-editor-next.sidebar.transformations-empty', 'No transformations')} />
        )}
      </CollapsableSection>
    </>
  );
}
