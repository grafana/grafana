import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

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
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getRulesPermissions } from 'app/features/alerting/unified/utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { getQueryRunnerFor } from '../../utils/utils';

import { DetailView } from './DetailView';
import { PanelDataAlertingTab } from './PanelDataAlertingTab';
import { PanelDataQueriesTab } from './PanelDataQueriesTab';
import { PanelDataTransformationsTab } from './PanelDataTransformationsTab';
import { QueryTransformList, QueryTransformItem } from './QueryTransformList';
import { TransformationsDrawer } from './TransformationsDrawer';
import { PanelDataPaneTab, TabId } from './types';

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

  // Subscribe to data transformer state changes
  const dataTransformer = panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : null;
  const transformerState = dataTransformer?.useState();

  // Build combined items list
  const items: QueryTransformItem[] = useMemo(() => {
    const result: QueryTransformItem[] = [];

    // Add queries
    const queries = queryRunnerState?.queries || [];
    queries.forEach((query, index) => {
      if ('refId' in query) {
        result.push({
          id: `query-${query.refId}`,
          type: 'query',
          data: query,
          index,
        });
      }
    });

    // Add transformations
    const rawTransformations = transformerState?.transformations || [];
    const transformations = Array.isArray(rawTransformations)
      ? rawTransformations.filter(
          (t): t is DataTransformerConfig =>
            t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
        )
      : [];
    transformations.forEach((transform, index) => {
      result.push({
        id: `transform-${index}`,
        type: 'transform',
        data: transform,
        index,
      });
    });

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
          setSelectedId(`query-${newQueries[newQueries.length - 1].refId}`);
        }
      }, 100);
    }
  }, [tabs, panel]);

  const handleAddTransform = useCallback(() => {
    setTransformDrawerOpen(true);
  }, []);

  const handleTransformationAdd = useCallback(
    (selected: SelectableValue<string>) => {
      if (!selected.value) {
        return;
      }

      const transformsTab = tabs.find((t) => t.tabId === TabId.Transformations);
      if (transformsTab instanceof PanelDataTransformationsTab) {
        const transformer = transformsTab.getDataTransformer();
        const rawTransformations = transformer.state.transformations || [];
        const transformations = Array.isArray(rawTransformations)
          ? rawTransformations.filter(
              (t): t is DataTransformerConfig =>
                t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
            )
          : [];

        const newTransformation: DataTransformerConfig = {
          id: selected.value,
          options: {},
        };

        transformsTab.onChangeTransformations([...transformations, newTransformation]);
        setTransformDrawerOpen(false);

        // Select the newly added transformation
        setTimeout(() => {
          setSelectedId(`transform-${transformations.length}`);
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
          setSelectedId(`query-${newRefId}`);
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
        if (selectedId === `query-${queries[index]?.refId}`) {
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

  const handleRemoveTransform = useCallback(
    (index: number) => {
      const transformsTab = tabs.find((t) => t.tabId === TabId.Transformations);
      if (transformsTab instanceof PanelDataTransformationsTab) {
        const transformer = transformsTab.getDataTransformer();
        const rawTransformations = transformer.state.transformations || [];
        const transformations = Array.isArray(rawTransformations)
          ? rawTransformations.filter(
              (t): t is DataTransformerConfig =>
                t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string'
            )
          : [];
        const newTransformations = transformations.filter((_, i) => i !== index);
        transformsTab.onChangeTransformations(newTransformations);

        // Clear selection if removing the selected transformation
        if (selectedId === `transform-${index}`) {
          setSelectedId(null);
        }
      }
    },
    [tabs, selectedId]
  );

  // Get data for transformations drawer
  const sourceData = queryRunner?.useState();
  const series = sourceData?.data?.series || [];

  return (
    <div className={styles.dataPane} data-testid={selectors.components.PanelEditor.DataPane.content}>
      <div className={styles.unifiedLayout}>
        <div className={styles.splitLayout}>
          <div className={styles.leftPanel}>
            <QueryTransformList
              items={items}
              selectedId={effectiveSelectedId}
              onSelect={handleSelect}
              onAddQuery={handleAddQuery}
              onAddTransform={handleAddTransform}
              onDuplicateQuery={handleDuplicateQuery}
              onRemoveQuery={handleRemoveQuery}
              onToggleQueryVisibility={handleToggleQueryVisibility}
              onRemoveTransform={handleRemoveTransform}
            />
          </div>
          <div className={styles.rightPanel}>
            <DetailView selectedItem={selectedItem} panel={panel} tabs={tabs} />
          </div>
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
      border: `1px solid ${theme.colors.border.weak}`,
      borderLeft: 'none',
      borderBottom: 'none',
      borderTopRightRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    splitLayout: css({
      display: 'flex',
      height: '100%',
      width: '100%',
    }),
    leftPanel: css({
      width: '25%',
      minWidth: '200px',
      maxWidth: '400px',
      flexShrink: 0,
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    rightPanel: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
    }),
  };
}
