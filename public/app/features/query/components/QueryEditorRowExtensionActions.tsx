import { type JSX } from 'react';

import {
  type ComponentTypeWithExtensionMeta,
  type CoreApp,
  type DataSourceInstanceSettings,
  PluginExtensionPoints,
  type PluginExtensionQueryEditorRowActionsV1Context,
  type TimeRange,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

interface Props {
  query: DataQuery;
  queries?: DataQuery[];
  dataSource?: DataSourceInstanceSettings;
  app?: CoreApp;
  timeRange?: TimeRange;
}

/**
 * Renders plugin-provided actions for a single query editor row.
 *
 * This is the plugin-facing counterpart of the core-only `RowActionComponents` registry: both are
 * rendered side by side, so registering through either mechanism keeps working. Each plugin gets a
 * single slot to keep the row header compact — a plugin that needs several buttons can render them
 * from within its own component.
 *
 * Returns an empty array when no plugin contributes to the extension point, so callers can decide
 * whether to render a wrapper at all.
 */
export function useQueryEditorRowExtensionActions({
  query,
  queries,
  dataSource,
  app,
  timeRange,
}: Props): JSX.Element[] {
  let components: Array<ComponentTypeWithExtensionMeta<PluginExtensionQueryEditorRowActionsV1Context>> = [];
  let isLoading = false;

  try {
    const result = usePluginComponents<PluginExtensionQueryEditorRowActionsV1Context>({
      extensionPointId: PluginExtensionPoints.QueryEditorRowActions,
      limitPerPlugin: 1,
    });
    components = result.components;
    isLoading = result.isLoading;
  } catch (error) {
    // `usePluginComponents` throws when the Grafana instance has not started, which is the case in
    // unit tests that render a query editor without bootstrapping the extension registries.
    return [];
  }

  if (isLoading || !components.length) {
    return [];
  }

  const context: PluginExtensionQueryEditorRowActionsV1Context = {
    query,
    queries,
    dataSource: dataSource ? { uid: dataSource.uid, type: dataSource.type, name: dataSource.name } : undefined,
    app,
    timeRange: timeRange?.raw,
  };

  return components.map((Component) => <Component key={Component.meta.id} {...context} />);
}

/** Component wrapper around {@link useQueryEditorRowExtensionActions} for class-component callers. */
export function QueryEditorRowExtensionActions(props: Props): JSX.Element | null {
  const actions = useQueryEditorRowExtensionActions(props);

  if (!actions.length) {
    return null;
  }

  return <>{actions}</>;
}
