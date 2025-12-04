import { css } from '@emotion/css';
import { memo, useCallback, useRef } from 'react';

import { DataFrame, DataQuery, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { Container, ScrollContainer, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { DetailViewHeader } from './DetailViewHeader';
import { ExpressionDetailView } from './ExpressionDetailView';
import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';
import { QueryDetailView } from './QueryDetailView';
import { QueryLibraryView, QueryLibraryViewRef } from './QueryLibraryView';
import { TransformationPickerView } from './TransformationPickerView';
import { TabId, QueryTransformItem } from './types';

export interface QueryLibraryMode {
  active: boolean;
  mode: 'browse' | 'save';
  currentQuery?: DataQuery;
}

interface DetailViewProps {
  selectedItem: QueryTransformItem | undefined;
  panel: VizPanel;
  tabs: Array<{ tabId: TabId }>;
  onRemoveTransform?: (index: number) => void;
  onToggleTransformVisibility?: (index: number) => void;
  isAddingTransform?: boolean;
  onAddTransformation?: (selectedItem: SelectableValue<string>, customOptions?: Record<string, unknown>) => void;
  onCancelAddTransform?: () => void;
  transformationData?: DataFrame[];
  onGoToQueries?: () => void;
  queryLibraryMode?: QueryLibraryMode;
  onQueryLibrarySelect?: (query: DataQuery) => void;
  onQueryLibrarySave?: (name: string, description: string) => void;
  onQueryLibraryClose?: () => void;
  onOpenQueryLibrary?: (mode: 'browse' | 'save', index?: number) => void;
  isDebugMode?: boolean;
  debugPosition?: number;
}

export const DetailView = memo(
  ({
    selectedItem,
    panel,
    tabs,
    onRemoveTransform,
    onToggleTransformVisibility,
    isAddingTransform,
    onAddTransformation,
    onCancelAddTransform,
    transformationData,
    onGoToQueries,
    queryLibraryMode,
    onQueryLibrarySelect,
    onQueryLibrarySave,
    onQueryLibraryClose,
    onOpenQueryLibrary,
    isDebugMode,
    debugPosition,
  }: DetailViewProps) => {
    const styles = useStyles2(getStyles);
    const queryLibraryRef = useRef<QueryLibraryViewRef>(null);

    const handleSelectQueryFromHeader = useCallback(() => {
      queryLibraryRef.current?.selectCurrentQuery();
    }, []);

    const handleSaveQueryFromHeader = useCallback(() => {
      queryLibraryRef.current?.saveQuery();
    }, []);

    const renderContent = useCallback(() => {
      // Show transformation picker when in add mode
      if (isAddingTransform && onAddTransformation && onCancelAddTransform) {
        return (
          <TransformationPickerView
            data={transformationData || []}
            onAddTransformation={onAddTransformation}
            onCancel={onCancelAddTransform}
            onGoToQueries={onGoToQueries}
          />
        );
      }

      // Show QueryLibraryView when in query library mode
      if (queryLibraryMode?.active && onQueryLibraryClose) {
        return (
          <>
            <DetailViewHeader
              queryLibraryMode={queryLibraryMode.mode}
              onSelectQuery={queryLibraryMode.mode === 'browse' ? handleSelectQueryFromHeader : undefined}
              onSaveQuery={queryLibraryMode.mode === 'save' ? handleSaveQueryFromHeader : undefined}
              onClose={onQueryLibraryClose}
            />
            <QueryLibraryView
              ref={queryLibraryRef}
              mode={queryLibraryMode.mode}
              currentQuery={queryLibraryMode.currentQuery}
              onSelectQuery={onQueryLibrarySelect}
              onSaveQuery={onQueryLibrarySave}
              onClose={onQueryLibraryClose}
            />
          </>
        );
      }

      if (!selectedItem) {
        return (
          <div className={styles.emptyState}>
            <p>
              <Trans i18nKey="dashboard-scene.panel-data-pane.empty-state">
                Select a query or transformation to edit
              </Trans>
            </p>
          </div>
        );
      }

      if (selectedItem.type === 'query' && 'refId' in selectedItem.data) {
        const query = selectedItem.data;
        return (
          <>
            <DetailViewHeader selectedItem={selectedItem} panel={panel} onOpenQueryLibrary={onOpenQueryLibrary} />
            <ScrollContainer>
              <QueryDetailView panel={panel} query={query} queryIndex={selectedItem.index} />
            </ScrollContainer>
          </>
        );
      } else if (selectedItem.type === 'expression' && 'refId' in selectedItem.data) {
        const data = selectedItem.data;
        if (isExpressionQuery(data)) {
          return (
            <>
              <DetailViewHeader selectedItem={selectedItem} panel={panel} />
              <ScrollContainer>
                <ExpressionDetailView panel={panel} expression={data} expressionIndex={selectedItem.index} />
              </ScrollContainer>
            </>
          );
        }
      } else {
        const transformsTab = tabs.find((t): t is PanelDataTransformationsTab => t.tabId === TabId.Transformations);
        if (transformsTab && 'id' in selectedItem.data) {
          return (
            <>
              <DetailViewHeader
                selectedItem={selectedItem}
                panel={panel}
                onRemoveTransform={onRemoveTransform}
                onToggleTransformVisibility={onToggleTransformVisibility}
                isDebugMode={isDebugMode}
                debugPosition={debugPosition}
              />
              <ScrollContainer>
                <Container>
                  <PanelDataTransformationsTabRendered model={transformsTab} selectedIdx={selectedItem.index} />
                </Container>
              </ScrollContainer>
            </>
          );
        }
      }

      return null;
    }, [
      selectedItem,
      panel,
      tabs,
      styles.emptyState,
      onRemoveTransform,
      onToggleTransformVisibility,
      isAddingTransform,
      onAddTransformation,
      onCancelAddTransform,
      transformationData,
      onGoToQueries,
      queryLibraryMode,
      onQueryLibrarySelect,
      onQueryLibrarySave,
      onQueryLibraryClose,
      onOpenQueryLibrary,
      handleSelectQueryFromHeader,
      handleSaveQueryFromHeader,
      isDebugMode,
      debugPosition,
    ]);

    return <div className={styles.container}>{renderContent()}</div>;
  }
);

DetailView.displayName = 'DetailView';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderTopLeftRadius: theme.shape.radius.md,
      borderTopRightRadius: theme.shape.radius.md,
      overflow: 'hidden',
    }),
    emptyState: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h5.fontSize,
    }),
  };
};
