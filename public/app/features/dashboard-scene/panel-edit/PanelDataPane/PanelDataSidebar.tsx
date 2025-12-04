import { css } from '@emotion/css';
import { useCallback, useState, useEffect, useMemo } from 'react';

import { DataQuery, DataTransformerConfig, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneDataQuery } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { ExpressionQueryType } from '../../../expressions/types';
import { getQueryRunnerFor } from '../../utils/utils';

import { QueryLibraryMode } from './DetailView';
import { PanelDataPane } from './PanelDataPane';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { QueryTransformList } from './QueryTransformList';
import { useQueryTransformItems } from './hooks';
import { TabId } from './types';
import { isDataTransformerConfig, queryItemId, transformItemId } from './utils';

export function PanelDataSidebarRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const { panelRef, tabs, selectedQueryTransform, sidebarCollapsed, transformPickerIndex } = model.useState();
  const styles = useStyles2(getStyles, sidebarCollapsed);

  const panel = panelRef.resolve();

  // Subscribe to query runner and tab state changes
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const queriesTab = tabs.find((t): t is PanelDataQueriesTab => t.tabId === TabId.Queries);
  const transformsTab = tabs.find((t): t is PanelDataTransformationsTab => t.tabId === TabId.Transformations);
  const transformer = transformsTab?.getDataTransformer();
  const transformerState = transformer?.useState();
  const queries = queryRunnerState?.queries;
  const transformations = transformerState?.transformations?.filter(isDataTransformerConfig);

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
        model.onChangeSelected(queryItemId(updatedQuery));
      }
    });
  }, [queryRunner, model]);

  // Build separate lists for queries/expressions and transformations
  const { queryExpressionItems, transformItems, allItems } = useQueryTransformItems(queries, transformations);

  // Auto-select first item if nothing is selected
  const selectedId = useMemo(() => {
    if (selectedQueryTransform === null && allItems.length > 0) {
      return allItems[0].id;
    }
    return selectedQueryTransform;
  }, [selectedQueryTransform, allItems]);
  const selectedItem = useMemo(() => allItems.find((item) => item.id === selectedId), [allItems, selectedId]);

  const updateQuerySelectionOnStateChange = useCallback(
    (index: number) => {
      if (queryRunner) {
        const unsub = queryRunner.subscribeToState((newState) => {
          const newQueries = newState.queries;
          if (newQueries.length > 0) {
            const selected = newQueries[index] ?? newQueries[0];
            model.onChangeSelected(queryItemId(selected));
          }
          unsub.unsubscribe();
        });
      }
    },
    [queryRunner, model]
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
          const prevQuery = newQueries?.[index - 1];
          model.onChangeSelected(prevQuery ? queryItemId(prevQuery) : null);
        }
      }
    },
    [queryRunner, selectedId, queries, model]
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

  const handleOpenQueryLibrary = useCallback(
    (mode: QueryLibraryMode["mode"], index?: number) => {
      let currentQuery: SceneDataQuery | undefined;

      if (
        mode === 'save' &&
        (selectedItem?.type === 'query' || selectedItem?.type === 'expression')
      ) {
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
          model.onChangeSelected(prevTransform ? transformItemId(index - 1) : null);
        }
      }
    },
    [transformations, transformsTab, selectedId, model]
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
        const newTransformations = [...(transformations ?? [])];
        const [removed] = newTransformations.splice(startIndex, 1);
        newTransformations.splice(endIndex, 0, removed);
        transformsTab.onChangeTransformations(newTransformations);
      }
    },
    [transformations, transformsTab]
  );

  // Get data for transformations drawer
  const sourceData = queryRunner?.useState();
  const series = sourceData?.data?.series || [];

  if (sidebarCollapsed) {
    return (
      <div className={styles.sidebarPane}>
        <Button
          icon="angle-right"
          variant="secondary"
          onClick={() => model.onCollapseSidebar(false)}
          tooltip={t('app.features.dashboardScene.panelEdit.panelDataPane.expandSidebar', 'Expand sidebar')}
        />
      </div>
    );
  }

  return (
    <div className={styles.sidebarPane}>
      <QueryTransformList
        allItems={allItems}
        dataSourceItems={queryExpressionItems}
        transformItems={transformItems}
        selectedId={selectedId}
        onCollapseSidebar={() => model.onCollapseSidebar(true)}
        onSelect={(id) => {
          model.onChangeSelected(id)
        }}
        onAddQuery={handleAddQuery}
        onAddFromSavedQueries={(index) => handleOpenQueryLibrary('browse', index)}
        onAddTransform={(index) => {
          model.onChangeSelected(null);
          model.onTransformPicker(index);
        }}
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
      <QueryTransformList
        allItems={allItems}
        dataSourceItems={queryExpressionItems}
        transformItems={transformItems}
        selectedId={selectedId}
        onCollapseSidebar={() => model.onCollapseSidebar(true)}
        onSelect={(newSelectedId) => model.onChangeSelected(newSelectedId)}
        onAddQuery={handleAddQuery}
        onAddFromSavedQueries={(index) => handleOpenQueryLibrary('browse', index)}
        onAddTransform={(index) => {
          model.onTransformPicker(index);
          model.onChangeSelected(null);
        }}
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

function getStyles(theme: GrafanaTheme2, collapsed: boolean) {
  return {
    sidebarPane: css({
      overflow: 'hidden',
      height: '100%',
      width: collapsed ? 49 : 300,
      padding: collapsed ? theme.spacing(1) : 'unset',
      borderTopRightRadius: theme.shape.radius.md,
      borderTop: `1px solid ${theme.colors.border.weak}`,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
  };
}
