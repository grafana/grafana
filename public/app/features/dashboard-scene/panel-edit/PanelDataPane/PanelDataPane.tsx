import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState, useEffect } from 'react';

import { DataQuery, DataTransformerConfig, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
  SceneDataQuery,
} from '@grafana/scenes';
import { useStyles2, useSplitter } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { isExpressionQuery } from '../../../expressions/guards';
import { ExpressionQueryType } from '../../../expressions/types';
import { getQueryRunnerFor } from '../../utils/utils';

import { DetailView } from './DetailView';
import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { QueryTransformList, QueryTransformItem } from './QueryTransformList';
import { SavedQueriesDrawer } from './SavedQueriesDrawer';
import { TransformationsDrawer } from './TransformationsDrawer';
import { PanelDataPaneTab, TabId } from './types';
import { isDataTransformerConfig, queryItemId, transformItemId } from './utils';

export interface PanelDataPaneState extends SceneObjectState {
  tabs: PanelDataPaneTab[];
  tab: TabId;
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataPane extends SceneObjectBase<PanelDataPaneState> {
  static Component = PanelDataPaneRendered;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tab'] });

  public static createFor(panel: VizPanel) {
    const panelRef = panel.getRef();
    const tabs: PanelDataPaneTab[] = [
      new PanelDataQueriesTab({ panelRef }),
      new PanelDataTransformationsTab({ panelRef }),
    ];

    if (shouldShowAlertingTab(panel.state.pluginId)) {
      tabs.push(new PanelDataAlertingTab({ panelRef }));
    }

    return new PanelDataPane({
      panelRef,
      tabs,
      tab: TabId.Queries,
    });
  }

  public onChangeTab = (tab: PanelDataPaneTab) => {
    this.setState({ tab: tab.tabId });
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

interface DrawerState {
  open: boolean;
  index: number | null;
}

function PanelDataPaneRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const { tabs, panelRef } = model.useState();
  const styles = useStyles2(getStyles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedQueriesDrawerState, setSavedQueriesDrawerState] = useState<DrawerState>({
    open: false,
    index: null,
  });
  const [transformDrawerState, setTransformDrawerState] = useState<DrawerState>({
    open: false,
    index: null,
  });

  const panel = panelRef.resolve();

  // Subscribe to query runner and tab state changes
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const queriesTab = tabs.find((t): t is PanelDataQueriesTab => t.tabId === TabId.Queries);
  const transformsTab = tabs.find((t): t is PanelDataTransformationsTab => t.tabId === TabId.Transformations);
  const transformer = transformsTab?.getDataTransformer();
  const transformerState = transformer?.useState();
  const queries = queryRunnerState?.queries;
  const transformations = transformerState?.transformations;

  // the selectedId is based on the refId of the query. refId is a user-editable property, so it can change,
  // which will break the selectId and result in the UI going into a deselected state. to avoid this,
  // we can subscribe to changes and detect if a single refId just changed, and then assume that change
  // is a rename of the currently selected query.
  useEffect(() => {
    queryRunner?.subscribeToState((newState, prevState) => {
      // loop over the new queries and confirm that the refIds are the same. if not, then a mutation
      // occurred, but we need to figure out if it was a rename or a reorder
      const oldOrderedRefIds = prevState.queries.map(({ refId }) => refId);
      if (newState.queries.length !== oldOrderedRefIds.length) {
        return; // add, remove, something else.
      }

      let refIdChanges = 0;
      let updatedQuery: SceneDataQuery | undefined = undefined;
      for (let i = 0; i < newState.queries.length; i++) {
        const newQuery = newState.queries[i];
        const oldRefId = oldOrderedRefIds[i];
        if (newQuery.refId !== oldRefId) {
          if (++refIdChanges < 2) {
            updatedQuery = newQuery;
          } else {
            return; // more than 2 refId changes, so it's a reorder or something else.
          }
        }
      }

      if (updatedQuery) {
        setSelectedId(queryItemId(updatedQuery));
      }
    });
  }, [queryRunner]);

  // Build separate lists for queries/expressions and transformations
  const { dataSourceItems, transformItems, allItems } = useMemo(() => {
    const dataSourceItems: QueryTransformItem[] = [];
    const transformItems: QueryTransformItem[] = [];

    // Add queries and expressions
    for (let i = 0; i < (queries?.length ?? 0); i++) {
      const query = queries![i];
      dataSourceItems.push({
        id: queryItemId(query),
        type: isExpressionQuery(query) ? 'expression' : 'query',
        data: query,
        index: i, // Store actual index in queries array
      });
    }

    // Add transformations
    for (let i = 0; i < (transformations?.length ?? 0); i++) {
      const transform = transformations![i];
      if (isDataTransformerConfig(transform)) {
        transformItems.push({
          id: transformItemId(i),
          type: 'transform',
          data: transform,
          index: i,
        });
      }
    }

    return {
      dataSourceItems,
      transformItems,
      allItems: [...dataSourceItems, ...transformItems],
    };
  }, [queries, transformations]);

  // Auto-select first item if nothing is selected
  const effectiveSelectedId = useMemo(() => {
    if (selectedId === null && allItems.length > 0) {
      return allItems[0].id;
    }
    return selectedId;
  }, [selectedId, allItems]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === effectiveSelectedId),
    [allItems, effectiveSelectedId]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const updateQuerySelectionOnStateChange = useCallback(
    (index: number) => {
      if (queryRunner) {
        const unsub = queryRunner.subscribeToState((newState) => {
          const newQueries = newState.queries;
          if (newQueries.length > 0) {
            const selected = newQueries[index] ?? newQueries[0];
            setSelectedId(queryItemId(selected));
          }
          unsub.unsubscribe();
        });
      }
    },
    [queryRunner]
  );

  /** QUERIES AND EXPRESSIONS **/
  const handleAddQuery = useCallback(
    (index?: number) => {
      if (queriesTab) {
        updateQuerySelectionOnStateChange(index ?? queries?.length ?? 0);
        queriesTab.addQueryClick(index);
      }
    },
    [queries, queriesTab, updateQuerySelectionOnStateChange]
  );

  const handleAddExpression = useCallback(
    (type: ExpressionQueryType, index?: number) => {
      if (queriesTab) {
        updateQuerySelectionOnStateChange(index ?? queries?.length ?? 0);
        queriesTab.onAddExpressionOfType(type, index);
      }
    },
    [queriesTab, updateQuerySelectionOnStateChange, queries]
  );

  const handleDuplicateQuery = useCallback(
    (index: number) => {
      if (queryRunner && queriesTab) {
        const queryToDuplicate = queries?.[index];
        if (queryToDuplicate) {
          // Create a copy with a new refId
          let newRefId = queryToDuplicate.refId;
          let counter = 1;
          while (queries.some((q) => q.refId === newRefId)) {
            newRefId = `${queryToDuplicate.refId}_${counter}`;
            counter++;
          }

          const duplicatedQuery = {
            ...queryToDuplicate,
            refId: newRefId,
          };

          updateQuerySelectionOnStateChange(index + 1);
          queriesTab.onAddQuery(duplicatedQuery, index + 1);
        }
      }
    },
    [queryRunner, queriesTab, queries, updateQuerySelectionOnStateChange]
  );

  const handleRemoveQuery = useCallback(
    (index: number) => {
      if (queryRunner) {
        const deletedQuery = queries?.[index];
        const newQueries = queries?.filter((_, i) => i !== index);
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();

        // Clear selection if removing the selected query
        if (deletedQuery && selectedId === queryItemId(deletedQuery)) {
          setSelectedId(null);
        }
      }
    },
    [queryRunner, selectedId, queries]
  );

  const handleToggleQueryVisibility = useCallback(
    (index: number) => {
      if (queryRunner) {
        const newQueries = queries?.map((q, i) => (i === index ? { ...q, hide: !q.hide } : q));
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();
      }
    },
    [queryRunner, queries]
  );

  // This is a stub for the saved queries drawer
  const handleSelectSavedQuery = useCallback(
    (query: DataQuery) => {
      if (!queryRunner || !queriesTab) {
        return;
      }

      const selectedIndex = savedQueriesDrawerState.index ?? queries?.length ?? 0;

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
      const newQuery: DataQuery = {
        ...query,
        refId: nextRefId,
      };

      updateQuerySelectionOnStateChange(selectedIndex);
      queriesTab.onAddQuery(newQuery);

      setSavedQueriesDrawerState({ open: false, index: null });
    },
    [queryRunner, savedQueriesDrawerState.index, queries, updateQuerySelectionOnStateChange, queriesTab]
  );

  /** TRANSFORMS **/
  const handleAddTransform = useCallback(
    (selected: SelectableValue<string>, customOptions?: Record<string, unknown>) => {
      if (!selected.value) {
        return;
      }

      if (transformsTab && transformer) {
        const selectedIndex = transformDrawerState.index ?? transformations?.length ?? 0;
        const newTransformation: DataTransformerConfig = {
          id: selected.value,
          options: customOptions ?? {},
        };

        const unsub = transformer.subscribeToState((newState) => {
          const newTransform = newState.transformations[selectedIndex];

          setSelectedId(!!newTransform ? transformItemId(selectedIndex) : null);
          setTransformDrawerState({ open: false, index: null });
          unsub.unsubscribe();
        });

        const newTransformations = [...(transformations?.filter(isDataTransformerConfig) ?? [])];
        newTransformations.splice(selectedIndex, 0, newTransformation);

        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformsTab, transformer, transformations, transformDrawerState.index]
  );

  const handleRemoveTransform = useCallback(
    (index: number) => {
      if (transformsTab) {
        const transformations = (transformsTab.getDataTransformer().state.transformations || []).filter(
          isDataTransformerConfig
        );
        const newTransformations = transformations.filter((_, i) => i !== index);
        transformsTab.onChangeTransformations(newTransformations);

        // Clear selection if removing the selected transformation
        if (selectedId === transformItemId(index)) {
          setSelectedId(null);
        }
      }
    },
    [transformsTab, selectedId]
  );

  const handleToggleTransformVisibility = useCallback(
    (index: number) => {
      if (transformsTab) {
        const transformations = (transformsTab.getDataTransformer().state.transformations || []).filter(
          isDataTransformerConfig
        );
        const newTransformations = transformations.map((t, i) =>
          i === index ? { ...t, disabled: t.disabled ? undefined : true } : t
        );
        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformsTab]
  );

  const handleReorderDataSources = useCallback(
    (startIndex: number, endIndex: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = Array.from(queries);
        const [removed] = newQueries.splice(startIndex, 1);
        newQueries.splice(endIndex, 0, removed);
        queryRunner.setState({ queries: newQueries });
      }
    },
    [queryRunner]
  );

  const handleReorderTransforms = useCallback(
    (startIndex: number, endIndex: number) => {
      if (transformsTab) {
        const transformations = (transformsTab.getDataTransformer().state.transformations || []).filter(
          isDataTransformerConfig
        );
        const newTransformations = Array.from(transformations);
        const [removed] = newTransformations.splice(startIndex, 1);
        newTransformations.splice(endIndex, 0, removed);
        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformsTab]
  );

  // Get data for transformations drawer
  const sourceData = queryRunner?.useState();
  const series = sourceData?.data?.series || [];

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'row',
    initialSize: 0.01,
    handleSize: 'xs',
  });

  return (
    <div className={styles.dataPane} data-testid={selectors.components.PanelEditor.DataPane.content}>
      <div {...containerProps} className={cx(containerProps.className, styles.unifiedLayout)}>
        <div {...primaryProps} className={cx(primaryProps.className, styles.leftPane)}>
          <QueryTransformList
            allItems={allItems}
            dataSourceItems={dataSourceItems}
            transformItems={transformItems}
            selectedId={effectiveSelectedId}
            onSelect={handleSelect}
            onAddQuery={handleAddQuery}
            onAddFromSavedQueries={(index) => setSavedQueriesDrawerState({ open: true, index: index ?? null })}
            onAddTransform={(index) => setTransformDrawerState({ open: true, index: index ?? null })}
            onAddExpression={handleAddExpression}
            onDuplicateQuery={handleDuplicateQuery}
            onRemoveQuery={handleRemoveQuery}
            onToggleQueryVisibility={handleToggleQueryVisibility}
            onRemoveTransform={handleRemoveTransform}
            onToggleTransformVisibility={handleToggleTransformVisibility}
            onReorderDataSources={handleReorderDataSources}
            onReorderTransforms={handleReorderTransforms}
            onAddOrganizeFieldsTransform={() =>
              handleAddTransform(
                { value: 'organize' },
                {
                  excludeByName: {},
                  indexByName: {},
                  renameByName: {},
                  includeByName: {},
                  orderByMode: 'auto',
                  orderBy: [
                    {
                      type: 'name',
                      desc: false,
                    },
                  ],
                }
              )
            }
          />
        </div>
        <div
          {...splitterProps}
          className={cx(splitterProps.className, styles.splitter)}
          style={{ ...splitterProps.style, width: '16px' }}
        />
        <div {...secondaryProps}>
          <DetailView
            selectedItem={selectedItem}
            panel={panel}
            tabs={tabs}
            onRemoveTransform={handleRemoveTransform}
            onToggleTransformVisibility={handleToggleTransformVisibility}
          />
        </div>
      </div>
      <TransformationsDrawer
        isOpen={transformDrawerState.open}
        onClose={() => setTransformDrawerState({ open: false, index: null })}
        onTransformationAdd={handleAddTransform}
        series={series}
      />
      <SavedQueriesDrawer
        isOpen={savedQueriesDrawerState.open}
        onClose={() => setSavedQueriesDrawerState({ open: false, index: null })}
        onSelectQuery={handleSelectSavedQuery}
      />
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

// Left pane sizing: cards grow from 180px-300px, plus content padding (48px + 64px = 112px)
const LEFT_PANE_MIN = 180 + 112; // 292px (180px card min + 112px padding)
const LEFT_PANE_MAX = 300 + 112; // 412px (300px card max + 112px padding)

function getStyles(theme: GrafanaTheme2) {
  return {
    dataPane: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
      height: '100%',
      width: '100%',
    }),
    unifiedLayout: css({
      flex: 1,
      minHeight: 0,
      background: theme.colors.background.primary,
      overflow: 'hidden',
    }),
    splitter: css({
      position: 'relative',
      background: theme.colors.background.canvas,
      cursor: 'col-resize',
    }),
    leftPane: css({
      // !important on minWidth to override useSplitter's inline minWidth: 'min-content'
      minWidth: `${LEFT_PANE_MIN}px !important`,
      maxWidth: `${LEFT_PANE_MAX}px`,
      overflow: 'hidden',
    }),
  };
}
