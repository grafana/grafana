import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';

import { DataTransformerConfig, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
  SceneDataTransformer,
  SceneDataQuery,
} from '@grafana/scenes';
import { useStyles2, useSplitter } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { isExpressionQuery } from '../../../expressions/guards';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from '../../../expressions/types';
import { getDefaults } from '../../../expressions/utils/expressionTypes';
import { getQueryRunnerFor } from '../../utils/utils';

import { DetailView } from './DetailView';
import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { QueryTransformList, QueryTransformItem } from './QueryTransformList';
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

function PanelDataPaneRendered({ model }: SceneComponentProps<PanelDataPane>) {
  const { tabs, panelRef } = model.useState();
  const styles = useStyles2(getStyles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transformDrawerOpen, setTransformDrawerOpen] = useState(false);

  const panel = panelRef.resolve();

  // Subscribe to query runner state changes
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();

  // the selectedId is based on the refId of the query. refId is a user-editable property, so it can change,
  // which will break the selectId and result in the UI going into a deselected state. to avoid this,
  // we can subscribe to changes and detect if a single refId just changed, and then assume that change
  // is a rename of the currently selected query.
  const orderedRefIds = useRef<string[]>(queryRunnerState?.queries.map(({ refId }) => refId) ?? []);
  useEffect(() => {
    queryRunner?.subscribeToState((newState) => {
      // loop over the new queries and confirm that the refIds are the same. if not, then a mutation
      // occurred, but we need to figure out if it was a rename or a reorder

      const oldOrderedRefIds = orderedRefIds.current;
      orderedRefIds.current = newState.queries.map(({ refId }) => refId);

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

  // Subscribe to data transformer state changes
  const dataTransformer = panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : null;
  const transformerState = dataTransformer?.useState();

  // Build combined items list
  const items: QueryTransformItem[] = useMemo(() => {
    const result: QueryTransformItem[] = [];
    const queries = queryRunnerState?.queries;
    for (let i = 0; i < (queries?.length ?? 0); i++) {
      const query = queries![i];
      result.push({
        id: queryItemId(query),
        type: isExpressionQuery(query) ? 'expression' : 'query',
        data: query,
        index: i, // Store actual index in queries array
      });
    }

    const transformations = transformerState?.transformations;
    for (let i = 0; i < (transformations?.length ?? 0); i++) {
      const transform = transformations![i];
      if (isDataTransformerConfig(transform)) {
        result.push({
          id: transformItemId(i),
          type: 'transform',
          data: transform,
          index: i,
        });
      }
    }

    return result;
  }, [queryRunnerState?.queries, transformerState?.transformations]);

  // Auto-select first item if nothing is selected
  const effectiveSelectedId = useMemo(() => {
    if (selectedId === null && items.length > 0) {
      return items[0].id;
    }
    return selectedId;
  }, [selectedId, items]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === effectiveSelectedId);
  }, [items, effectiveSelectedId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleAddQuery = useCallback(() => {
    const queriesTab = tabs.find((t) => t.tabId === TabId.Queries);
    if (queriesTab instanceof PanelDataQueriesTab) {
      queriesTab.addQueryClick();
      // Select the new query after a short delay
      setTimeout(() => {
        const newQueries = getQueryRunnerFor(panel)?.state.queries || [];
        if (newQueries.length > 0) {
          setSelectedId(queryItemId(newQueries[newQueries.length - 1]));
        }
      }, 100);
    }
  }, [tabs, panel]);

  const handleAddTransform = useCallback(() => {
    setTransformDrawerOpen(true);
  }, []);

  const handleAddExpression = useCallback(
    (type: ExpressionQueryType) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];

        // Get next available refId
        const existingRefIds = queries.map((q) => q.refId);
        let nextRefId = 'A';
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (let i = 0; i < alphabet.length; i++) {
          if (!existingRefIds.includes(alphabet[i])) {
            nextRefId = alphabet[i];
            break;
          }
        }

        // Create new expression with defaults
        const newExpression: ExpressionQuery = getDefaults({
          refId: nextRefId,
          type,
          datasource: { uid: ExpressionDatasourceUID, type: '__expr__' },
        });

        // Add to queries
        const newQueries = [...queries, newExpression];
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();

        // Select the new expression
        setSelectedId(queryItemId(newExpression));
      }
    },
    [queryRunner]
  );

  const handleTransformationAdd = useCallback(
    (selected: SelectableValue<string>) => {
      if (!selected.value) {
        return;
      }

      const transformsTab = tabs.find((t) => t.tabId === TabId.Transformations);
      if (transformsTab instanceof PanelDataTransformationsTab) {
        const transformations = (transformsTab.getDataTransformer().state.transformations || []).filter(
          isDataTransformerConfig
        );
        const newTransformation: DataTransformerConfig = {
          id: selected.value,
          options: {},
        };

        transformsTab.onChangeTransformations([...transformations, newTransformation]);
        setTransformDrawerOpen(false);

        // Select the newly added transformation
        setTimeout(() => {
          setSelectedId(transformItemId(transformations.length));
        }, 100);
      }
    },
    [tabs]
  );

  const handleDuplicateQuery = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const queryToDuplicate = queries[index];
        if (queryToDuplicate) {
          // Create a copy with a new refId
          const existingRefIds = queries.map((q) => q.refId);
          let newRefId = queryToDuplicate.refId;
          let counter = 1;
          while (existingRefIds.includes(newRefId)) {
            newRefId = `${queryToDuplicate.refId}_${counter}`;
            counter++;
          }

          const duplicatedQuery = {
            ...queryToDuplicate,
            refId: newRefId,
          };

          const newQueries = [...queries, duplicatedQuery];
          queryRunner.setState({ queries: newQueries });
          queryRunner.runQueries();

          // Select the new query
          setSelectedId(queryItemId(duplicatedQuery));
        }
      }
    },
    [queryRunner]
  );

  const handleRemoveQuery = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.filter((_, i) => i !== index);
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();

        // Clear selection if removing the selected query
        if (selectedId === queryItemId(queries[index])) {
          setSelectedId(null);
        }
      }
    },
    [queryRunner, selectedId]
  );

  const handleToggleQueryVisibility = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, i) => (i === index ? { ...q, hide: !q.hide } : q));
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();
      }
    },
    [queryRunner]
  );

  // Expression handlers (use actual index in queries array)
  const handleDuplicateExpression = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const expressionToDuplicate = queries[index];

        if (expressionToDuplicate && isExpressionQuery(expressionToDuplicate)) {
          const existingRefIds = queries.map((q) => q.refId);
          let newRefId = expressionToDuplicate.refId;
          let counter = 1;
          while (existingRefIds.includes(newRefId)) {
            newRefId = `${expressionToDuplicate.refId}_${counter}`;
            counter++;
          }

          const duplicatedExpression = {
            ...expressionToDuplicate,
            refId: newRefId,
          };

          const newQueries = [...queries, duplicatedExpression];
          queryRunner.setState({ queries: newQueries });
          queryRunner.runQueries();

          setSelectedId(queryItemId(duplicatedExpression));
        }
      }
    },
    [queryRunner]
  );

  const handleRemoveExpression = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.filter((_, i) => i !== index);
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();

        const expressionToRemove = queries[index];
        if (expressionToRemove && selectedId === queryItemId(expressionToRemove)) {
          setSelectedId(null);
        }
      }
    },
    [queryRunner, selectedId]
  );

  const handleToggleExpressionVisibility = useCallback(
    (index: number) => {
      if (queryRunner) {
        const queries = queryRunner.state.queries || [];
        const newQueries = queries.map((q, i) => (i === index ? { ...q, hide: !q.hide } : q));
        queryRunner.setState({ queries: newQueries });
        queryRunner.runQueries();
      }
    },
    [queryRunner]
  );

  const handleRemoveTransform = useCallback(
    (index: number) => {
      const transformsTab = tabs.find((t): t is PanelDataTransformationsTab => t.tabId === TabId.Transformations);
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
    [tabs, selectedId]
  );

  // Get data for transformations drawer
  const sourceData = queryRunner?.useState();
  const series = sourceData?.data?.series || [];

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'row',
    initialSize: 0.25,
    handleSize: 'xs',
  });

  return (
    <div className={styles.dataPane} data-testid={selectors.components.PanelEditor.DataPane.content}>
      <div {...containerProps} className={cx(containerProps.className, styles.unifiedLayout)}>
        <div {...primaryProps}>
          <QueryTransformList
            items={items}
            selectedId={effectiveSelectedId}
            onSelect={handleSelect}
            onAddQuery={handleAddQuery}
            onAddTransform={handleAddTransform}
            onAddExpression={handleAddExpression}
            onDuplicateQuery={handleDuplicateQuery}
            onRemoveQuery={handleRemoveQuery}
            onToggleQueryVisibility={handleToggleQueryVisibility}
            // TODO: can all the expression stuff just be handled with the query handlers since expressions are queries?
            onDuplicateExpression={handleDuplicateExpression}
            onRemoveExpression={handleRemoveExpression}
            onToggleExpressionVisibility={handleToggleExpressionVisibility}
            onRemoveTransform={handleRemoveTransform}
          />
        </div>
        <div
          {...splitterProps}
          className={cx(splitterProps.className, styles.splitter)}
          style={{ ...splitterProps.style, width: '16px' }}
        />
        <div {...secondaryProps}>
          <DetailView selectedItem={selectedItem} panel={panel} tabs={tabs} />
        </div>
      </div>
      <TransformationsDrawer
        isOpen={transformDrawerOpen}
        onClose={() => setTransformDrawerOpen(false)}
        onTransformationAdd={handleTransformationAdd}
        series={series}
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
  };
}
