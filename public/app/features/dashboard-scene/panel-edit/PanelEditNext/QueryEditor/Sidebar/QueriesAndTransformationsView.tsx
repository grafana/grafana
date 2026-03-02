import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { LoadingBar } from '@grafana/ui';

import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AddCardButton } from './AddCardButton';
import { QueryCard } from './Cards/QueryCard';
import { TransformationCard } from './Cards/TransformationCard';
import { DraggableList } from './DraggableList';
import { useSidebarDragAndDrop } from './DraggableList/useSidebarDragAndDrop';
import { SidebarCollapsableHeader } from './SidebarCollapsableHeader';

export function QueriesAndTransformationsView() {
  const { queries, isLoading } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  const [queriesOpen, setQueriesOpen] = useState(true);
  const [transformationsOpen, setTransformationsOpen] = useState(true);

  const expandQueries = useCallback(() => setQueriesOpen(true), []);
  const expandTransformations = useCallback(() => setTransformationsOpen(true), []);

  if (isLoading) {
    return (
      <LoadingBar
        width={400}
        ariaLabel={t(
          'query-editor-next.sidebar.loading-queries-transformations',
          'Loading queries and transformations'
        )}
      />
    );
  }

  return (
    <>
      <SidebarCollapsableHeader
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
      </SidebarCollapsableHeader>
      <SidebarCollapsableHeader
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
      </SidebarCollapsableHeader>
    </>
  );
}
