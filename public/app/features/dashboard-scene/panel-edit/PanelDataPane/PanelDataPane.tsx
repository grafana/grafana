import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { DataTransformerConfig, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneDataQuery,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { ExpressionQueryType } from 'app/features/expressions/types';

import { getQueryRunnerFor } from '../../utils/utils';

import { DetailView, QueryLibraryMode } from './DetailView';
import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataSidebarRendered } from './PanelDataSidebar';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { useQueryTransformItems } from './hooks';
import { PanelDataPaneTab, TabId } from './types';
import { isDataTransformerConfig, queryItemId, transformItemId } from './utils';

export interface PanelDataPaneState extends SceneObjectState {
  tabs: PanelDataPaneTab[];
  tab: TabId;
  sidebarCollapsed: boolean;
  selectedQueryTransform: string | null;
  panelRef: SceneObjectRef<VizPanel>;
  transformPickerIndex?: number | null;
  queryLibraryMode: QueryLibraryMode & { index: number | null };
  isDebugMode?: boolean;
  debugPosition?: number;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  static FooterComponent = PanelDataSidebarRendered;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab', 'selectedQueryTransform'] });

  public static createFor(panel: VizPanel) {
    const panelRef = panel.getRef();

    const tabs: PanelDataPaneTab[] = [
      new PanelDataQueriesTab({ panelRef: panel.getRef() }),
      new PanelDataTransformationsTab({ panelRef: panel.getRef() }),
    ];

    if (shouldShowAlertingTab(panel.state.pluginId)) {
      tabs.push(new PanelDataAlertingTab({ panelRef: panel.getRef() }));
    }
    const tab = tabs[0]?.tabId ?? TabId.Queries;

    return new PanelDataPane({
      selectedQueryTransform: null,
      panelRef,
      tabs,
      tab,
      sidebarCollapsed: false,
      queryLibraryMode: {
        active: false,
        mode: 'browse',
        index: null,
      },
      isDebugMode: false,
      debugPosition: 0,
    });
  }

  public onChangeTab = (tab: PanelDataPaneTab) => {
    this.setState({ tab: tab.tabId });
  };

  public onChangeSelected = (selectedId: string | null) => {
    this.setState({ selectedQueryTransform: selectedId });
  };

  public onCollapseSidebar = (newState: boolean) => {
    this.setState({ sidebarCollapsed: newState });
  };

  public onTransformPicker = (index?: number | null) => {
    this.setState({ transformPickerIndex: index });
  };

  public setQueryLibraryMode = (mode: QueryLibraryMode & { index: number | null }) => {
    this.setState({ queryLibraryMode: mode });
  };

  public setDebugState = (isDebugMode: boolean, debugPosition: number) => {
    this.setState({ isDebugMode, debugPosition });
  };

  public getUrlState() {
    return { tab: this.state.tab };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.tab) {
      return;
    }
    if (typeof values.tab === 'string') {
      const tabValue = values.tab;
      // Check if the value is a valid TabId
      if (tabValue === TabId.Queries || tabValue === TabId.Transformations || tabValue === TabId.Alert) {
        this.setState({ tab: tabValue });
      }
    }
  }
}

function PanelDataPaneRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const {
    tabs,
    selectedQueryTransform,
    panelRef,
    transformPickerIndex,
    queryLibraryMode,
    isDebugMode = false,
    debugPosition = 0,
  } = model.useState();
  const styles = useStyles2(getStyles);

  // Subscribe to query runner and tab state changes
  const panel = panelRef.resolve();
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const queriesTab = tabs.find((t): t is PanelDataQueriesTab => t.tabId === TabId.Queries);
  const transformsTab = tabs.find((t): t is PanelDataTransformationsTab => t.tabId === TabId.Transformations);
  const transformer = transformsTab?.getDataTransformer();
  const transformerState = transformer?.useState();
  const queries = queryRunnerState?.queries;
  const transformations = transformerState?.transformations?.filter(isDataTransformerConfig);

  const { allItems } = useQueryTransformItems(queries, transformations);
  const handleSelect = useCallback(
    (id: string | null) => {
      model.setState({ selectedQueryTransform: id });
      model.onTransformPicker(null);
    },
    [model]
  );

  // Auto-select first item if nothing is selected
  const selectedId = useMemo(() => {
    if (transformPickerIndex != null) {
      return null;
    }
    if (selectedQueryTransform === null && allItems.length > 0) {
      return allItems[0].id;
    }
    return selectedQueryTransform;
  }, [transformPickerIndex, selectedQueryTransform, allItems]);

  const selectedItem = useMemo(() => allItems.find((item) => item.id === selectedId), [allItems, selectedId]);

  const updateQuerySelectionOnStateChange = useCallback(
    (index: number) => {
      if (queryRunner) {
        const unsub = queryRunner.subscribeToState((newState) => {
          const newQueries = newState.queries;
          if (newQueries.length > 0) {
            const selected = newQueries[index] ?? newQueries[0];
            handleSelect(queryItemId(selected));
          }
          unsub.unsubscribe();
        });
      }
    },
    [queryRunner, handleSelect]
  );

  /** QUERIES AND EXPRESSIONS **/
  // Handler for selecting a query from the query library
  const handleQueryLibrarySelect = useCallback(
    (query: SceneDataQuery) => {
      if (!queryRunner || !queriesTab) {
        return;
      }

      const selectedIndex = queryLibraryMode.index ?? queries?.length ?? 0;

      // Get next available refId
      let nextRefId = 'A';
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < alphabet.length; i++) {
        if (!queries?.some((q) => q.refId === alphabet[i])) {
          nextRefId = alphabet[i];
          break;
        }
      }

      // Create new query with the selected refId
      const newQuery: SceneDataQuery = {
        ...query,
        refId: nextRefId,
      };

      updateQuerySelectionOnStateChange(selectedIndex);
      queriesTab.onAddQuery(newQuery);

      model.setQueryLibraryMode({ active: false, mode: 'browse', index: null });
    },
    [queryRunner, queryLibraryMode.index, queries, updateQuerySelectionOnStateChange, queriesTab, model]
  );

  // Handler for saving a query to the query library (stub)
  const handleQueryLibrarySave = useCallback(
    (_name: string, _description: string) => {
      // Stub: In real implementation, this would save to the query library
      model.setQueryLibraryMode({ active: false, mode: 'browse', index: null });
    },
    [model]
  );

  // Handler to close the query library view
  const handleQueryLibraryClose = useCallback(() => {
    model.setQueryLibraryMode({ active: false, mode: 'browse', index: null });
  }, [model]);

  // Handler to open query library in a specific mode
  const handleOpenQueryLibrary = useCallback(
    (mode: QueryLibraryMode['mode'], index?: number) => {
      let currentQuery: SceneDataQuery | undefined;

      if (mode === 'save' && (selectedItem?.type === 'query' || selectedItem?.type === 'expression')) {
        currentQuery = selectedItem.data;
      }

      model.setQueryLibraryMode({
        active: true,
        mode,
        currentQuery,
        index: index ?? null,
      });
    },
    [selectedItem, model]
  );

  const handleGoToQueries = useCallback(() => {
    // Close the transformation picker
    model.onTransformPicker(null);
    // Add a SQL expression
    if (queriesTab) {
      updateQuerySelectionOnStateChange(queries?.length ?? 0);
      queriesTab.onAddExpressionOfType(ExpressionQueryType.sql);
    }
  }, [queriesTab, updateQuerySelectionOnStateChange, queries, model]);

  /** TRANSFORMS **/
  const handleAddTransform = useCallback(
    (selected: SelectableValue<string>, customOptions?: Record<string, unknown>) => {
      if (!selected.value) {
        return;
      }

      if (transformsTab && transformer) {
        const selectedIndex = transformPickerIndex ?? transformations?.length ?? 0;
        const newTransformation: DataTransformerConfig = {
          id: selected.value,
          options: customOptions ?? {},
        };

        const unsub = transformer.subscribeToState((newState) => {
          const newTransform = newState.transformations[selectedIndex];

          model.onChangeSelected(!!newTransform ? transformItemId(selectedIndex) : null);
          model.onTransformPicker(null);
          unsub.unsubscribe();
        });

        const newTransformations = [...(transformations ?? [])];
        newTransformations.splice(selectedIndex, 0, newTransformation);

        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformsTab, transformer, transformPickerIndex, transformations, model]
  );

  const handleRemoveTransform = useCallback(
    (index: number) => {
      if (transformsTab) {
        const newTransformations = transformations?.filter((_, i) => i !== index) ?? [];
        transformsTab.onChangeTransformations(newTransformations);

        // Clear selection if removing the selected transformation
        if (selectedId === transformItemId(index)) {
          const prevTransform = newTransformations[index - 1];
          handleSelect(prevTransform ? transformItemId(index - 1) : null);
        }
      }
    },
    [transformations, transformsTab, selectedId, handleSelect]
  );

  const handleToggleTransformVisibility = useCallback(
    (index: number) => {
      if (transformsTab) {
        const newTransformations =
          transformations?.map((t, i) => (i === index ? { ...t, disabled: t.disabled ? undefined : true } : t)) ?? [];
        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformations, transformsTab]
  );

  // Get data for transformations drawer
  const sourceData = queryRunner?.useState();
  const series = sourceData?.data?.series || [];

  return (
    <div className={styles.dataPane} data-testid={selectors.components.PanelEditor.DataPane.content}>
      <div className={cx(styles.unifiedLayout)}>
        <DetailView
          selectedItem={selectedItem}
          panel={panel}
          tabs={tabs}
          onRemoveTransform={handleRemoveTransform}
          onToggleTransformVisibility={handleToggleTransformVisibility}
          isAddingTransform={transformPickerIndex != null}
          onAddTransformation={handleAddTransform}
          onCancelAddTransform={() => model.onTransformPicker(null)}
          transformationData={series}
          onGoToQueries={handleGoToQueries}
          queryLibraryMode={queryLibraryMode}
          onQueryLibrarySelect={handleQueryLibrarySelect}
          onQueryLibrarySave={handleQueryLibrarySave}
          onQueryLibraryClose={handleQueryLibraryClose}
          onOpenQueryLibrary={handleOpenQueryLibrary}
          isDebugMode={isDebugMode}
          debugPosition={debugPosition}
        />
      </div>
    </div>
  );
}

export function shouldShowAlertingTab(pluginId: string) {
  const { unifiedAlertingEnabled = false } = getConfig();
  const hasRuleReadPermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).read);
  const isAlertingAvailable = unifiedAlertingEnabled && hasRuleReadPermissions;
  if (!isAlertingAvailable) {
    return false;
  }

  const isGraph = pluginId === 'graph';
  const isTimeseries = pluginId === 'timeseries';

  return isGraph || isTimeseries;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dataPane: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      height: '100%',
      width: '100%',
      paddingLeft: theme.spacing(2),
    }),
    unifiedLayout: css({
      flex: 1,
      minHeight: 0,
      background: theme.colors.background.primary,
      overflow: 'hidden',
    }),
  };
}
