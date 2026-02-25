import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { LoadingBar } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { usePanelContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

import { AddCardButton } from './AddCardButton';
import { DraggableList } from './DraggableList';
import { QueryCard } from './QueryCard';
import { QuerySidebarCollapsableHeader } from './QuerySidebarCollapsableHeader';
import { TransformationCard } from './TransformationCard';
import { useSidebarDragAndDrop } from './useSidebarDragAndDrop';

export function QueriesAndTransformationsView() {
  const { queries } = useQueryRunnerContext();
  const { activeContext, setActiveContext } = useQueryEditorUIContext();
  const { transformations } = usePanelContext();
  const { onQueryDragEnd, onTransformationDragEnd } = useSidebarDragAndDrop();

  // Select whichever card comes first — query or expression — when nothing is selected yet.
  useEffect(() => {
    if (activeContext.view !== 'data' || activeContext.selection.kind !== 'none') {
      return;
    }
    const first = queries[0];
    if (!first) {
      return;
    }
    setActiveContext({
      view: 'data',
      selection: isExpressionQuery(first)
        ? { kind: 'expression', refId: first.refId }
        : { kind: 'query', refId: first.refId },
    });
  }, [queries, activeContext, setActiveContext]);

  // Hold the loading bar only until the first card is selected. We intentionally
  // do NOT gate on isLoading here — query data refreshes should not hide the
  // sidebar card list. The content area handles loading state for data runs.
  const isReady = activeContext.view !== 'data' || activeContext.selection.kind !== 'none' || queries.length === 0;

  if (!isReady) {
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
      <QuerySidebarCollapsableHeader
        label={t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
        headerAction={<AddCardButton variant="query" alwaysVisible />}
      >
        <DraggableList
          droppableId="query-sidebar-queries"
          items={queries}
          keyExtractor={(query) => query.refId}
          renderItem={(query) => <QueryCard query={query} />}
          onDragEnd={onQueryDragEnd}
        />
      </QuerySidebarCollapsableHeader>
      <QuerySidebarCollapsableHeader
        label={t('query-editor-next.sidebar.transformations', 'Transformations')}
        headerAction={<AddCardButton variant="transformation" alwaysVisible />}
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
      </QuerySidebarCollapsableHeader>
    </>
  );
}
