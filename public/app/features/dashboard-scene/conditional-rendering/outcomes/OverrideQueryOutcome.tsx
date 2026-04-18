import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import {
  CoreApp,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  GrafanaTheme2,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner, sceneGraph, VizPanel } from '@grafana/scenes';
import {
  DashboardRuleOutcomeOverrideQueryKind,
  DashboardRuleOutcomeOverrideQuerySpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2beta1';
import { Button, Field, Stack, useStyles2 } from '@grafana/ui';

import { DashboardRuleOutcomeKindTypes, OutcomeEditorProps, OutcomeRegistryItem } from './outcomeRegistry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DashboardLike {
  state: {
    body: { getVizPanels: () => VizPanel[] };
  };
  serializer?: {
    getPanelIdForElement: (elementId: string) => number | undefined;
  };
}

/**
 * Find the first VizPanel that matches a selected element target.
 * Uses the dashboard serializer to resolve element names to VizPanel keys,
 * falling back to direct key matching.
 */
function findTargetPanel(dashboard: DashboardLike | undefined, selectedTargets: string[]): VizPanel | undefined {
  if (!dashboard?.state?.body?.getVizPanels) {
    return undefined;
  }
  const panels = dashboard.state.body.getVizPanels();
  for (const target of selectedTargets) {
    if (!target.startsWith('element:')) {
      continue;
    }
    const elementId = target.slice('element:'.length);

    // Use the serializer to resolve element name -> numeric panel ID -> VizPanel key
    const numericId = dashboard.serializer?.getPanelIdForElement(elementId);
    if (numericId !== undefined) {
      const vizPanelKey = `panel-${numericId}`;
      const panel = panels.find((p) => p.state.key === vizPanelKey);
      if (panel) {
        return panel;
      }
    }

    // Direct key match fallback (works when element ID equals VizPanel key)
    const directMatch = panels.find((p) => p.state.key === elementId);
    if (directMatch) {
      return directMatch;
    }
  }
  return undefined;
}

/** Unwrap SceneDataTransformer to get the inner SceneQueryRunner. */
function getQueryRunner(panel: VizPanel): SceneQueryRunner | undefined {
  try {
    const data = sceneGraph.getData(panel);
    // Panels wrap their SceneQueryRunner in a SceneDataTransformer
    if (data instanceof SceneDataTransformer) {
      const inner = data.state.$data;
      return inner instanceof SceneQueryRunner ? inner : undefined;
    }
    if (data instanceof SceneQueryRunner) {
      return data;
    }
  } catch {
    // Panel might not have data provider
  }
  return undefined;
}

/** Resolve the datasource from a VizPanel's SceneQueryRunner via getDataSourceSrv(). */
async function loadDatasourceFromPanel(
  panel: VizPanel
): Promise<{ ds: DataSourceApi; settings: DataSourceInstanceSettings } | undefined> {
  const queryRunner = getQueryRunner(panel);
  if (!queryRunner) {
    return undefined;
  }

  // Use the query runner's datasource ref, falling back to first query's ref, then default
  const dsRef = queryRunner.state.datasource ?? queryRunner.state.queries[0]?.datasource;
  const dsSrv = getDataSourceSrv();

  try {
    const ds = await dsSrv.get(dsRef as string);
    const settings = dsSrv.getInstanceSettings(ds.uid);
    if (!settings) {
      return undefined;
    }
    return { ds, settings };
  } catch {
    return undefined;
  }
}

interface QueryEntry {
  id: number;
  query: DataQuery;
}

function OverrideQueryEditor({
  spec,
  onChange,
  dashboard,
  selectedTargets,
}: OutcomeEditorProps<DashboardRuleOutcomeOverrideQuerySpec>) {
  const styles = useStyles2(getStyles);
  const [datasource, setDatasource] = useState<DataSourceApi | null>(null);
  const [instanceSettings, setInstanceSettings] = useState<DataSourceInstanceSettings | null>(null);

  // Cast dashboard to DashboardLike to access body and serializer without circular imports
  const dashboardLike = dashboard as unknown as DashboardLike | undefined;

  const targetPanel = useMemo(
    () => (dashboardLike && selectedTargets ? findTargetPanel(dashboardLike, selectedTargets) : undefined),
    [dashboardLike, selectedTargets]
  );

  // Resolve datasource from the target panel via getDataSourceSrv().get(),
  // which handles default/null datasource refs automatically.
  useEffect(() => {
    if (!targetPanel) {
      setDatasource(null);
      setInstanceSettings(null);
      return;
    }

    let cancelled = false;
    loadDatasourceFromPanel(targetPanel).then((result) => {
      if (cancelled) {
        return;
      }
      if (result) {
        setDatasource(result.ds);
        setInstanceSettings(result.settings);
      } else {
        setDatasource(null);
        setInstanceSettings(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [targetPanel]);

  // Convert stored queries to QueryEntry objects
  const queries: QueryEntry[] = useMemo(
    () =>
      spec.queries.map((q, i) => ({
        id: i,
        query: {
          refId: (q as DataQuery).refId || String.fromCharCode(65 + i),
          ...q,
        } as DataQuery,
      })),
    [spec.queries]
  );

  const handleQueryChange = (index: number, updatedQuery: DataQuery) => {
    const newQueries = [...spec.queries];
    newQueries[index] = updatedQuery as Record<string, any>;
    onChange({ ...spec, queries: newQueries });
  };

  const handleAddQuery = () => {
    const refId = String.fromCharCode(65 + spec.queries.length);
    const newQuery: Record<string, any> = { refId };
    onChange({ ...spec, queries: [...spec.queries, newQuery] });
  };

  const handleRemoveQuery = (index: number) => {
    const newQueries = spec.queries.filter((_, i) => i !== index);
    onChange({ ...spec, queries: newQueries });
  };

  if (!targetPanel) {
    return (
      <div className={styles.notice}>
        Select a panel target first. The query editor uses the target panel's datasource.
      </div>
    );
  }

  if (!datasource || !instanceSettings) {
    return <div className={styles.notice}>Loading datasource...</div>;
  }

  const QueryEditor = datasource.components?.QueryEditor;
  if (!QueryEditor) {
    return <div className={styles.notice}>Datasource does not provide a query editor.</div>;
  }

  return (
    <Field label={`Override queries (${datasource.name})`}>
      <Stack direction="column" gap={1}>
        <DataSourcePluginContextProvider instanceSettings={instanceSettings}>
          {queries.map((entry, index) => (
            <div key={entry.id} className={styles.queryRow}>
              <div className={styles.queryLabel}>
                <span className={styles.refId}>{entry.query.refId}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="trash-alt"
                  fill="text"
                  onClick={() => handleRemoveQuery(index)}
                  tooltip="Remove query"
                />
              </div>
              <QueryEditor
                datasource={datasource}
                query={entry.query}
                onChange={(q: DataQuery) => handleQueryChange(index, q)}
                onRunQuery={() => {}}
                app={CoreApp.PanelEditor}
              />
            </div>
          ))}
        </DataSourcePluginContextProvider>
        <Button variant="secondary" icon="plus" size="sm" onClick={handleAddQuery}>
          Add query
        </Button>
      </Stack>
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    notice: css({
      padding: theme.spacing(1),
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    queryRow: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
    }),
    queryLabel: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(0.5),
    }),
    refId: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
  };
}

/**
 * Override query outcome: replaces the target panel's queries while conditions
 * are met. When conditions stop being met, the original queries are restored.
 * The datasource is inherited from the target panel and does not change.
 */
export const overrideQueryOutcome: OutcomeRegistryItem<DashboardRuleOutcomeOverrideQuerySpec> = {
  id: 'DashboardRuleOutcomeOverrideQuery',
  name: 'Override query',
  description: "Replace the target panel's queries",
  targetKinds: ['panel'],

  createDefaultSpec(): DashboardRuleOutcomeOverrideQuerySpec {
    return { queries: [] };
  },

  specFromKind(kind: DashboardRuleOutcomeKindTypes): DashboardRuleOutcomeOverrideQuerySpec {
    const oqKind = kind as DashboardRuleOutcomeOverrideQueryKind;
    return oqKind.spec;
  },

  specToKind(spec: DashboardRuleOutcomeOverrideQuerySpec): DashboardRuleOutcomeKindTypes {
    return {
      kind: 'DashboardRuleOutcomeOverrideQuery',
      spec,
    };
  },

  Editor: OverrideQueryEditor,
};
