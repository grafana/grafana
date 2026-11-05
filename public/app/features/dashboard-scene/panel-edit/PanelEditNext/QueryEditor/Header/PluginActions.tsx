import { useMemo } from 'react';

import {
  type CoreApp,
  PluginExtensionPoints,
  type PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context,
} from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { type QueryActionComponent, RowActionComponents } from 'app/features/query/components/QueryActionComponent';
import { useQueryEditorRowExtensionActions } from 'app/features/query/components/QueryEditorRowExtensionActions';

import { QueryEditorType } from '../../constants';
import { useActionsContext, useQueryRunnerContext } from '../QueryEditorContext';

import { type QueryActionTarget } from './headerActionTarget';

interface PluginActionsProps {
  target: QueryActionTarget;
  app?: CoreApp;
}

/**
 * Renders plugin-provided icon buttons (extra actions + adaptive telemetry)
 * directly in the header, outside of the actions dropdown menu.
 *
 * These are controlled by plugins and rendered as icon buttons, so they
 * need to live at the header level rather than inside a menu.
 */
export function PluginActions({ target, app }: PluginActionsProps) {
  const { queries, data } = useQueryRunnerContext();
  const { addQuery } = useActionsContext();
  const { query, cardType, dsData } = target;
  const dsSettings = dsData?.dsSettings;

  const extraActions = useMemo(() => {
    const unscopedActions = RowActionComponents.getAllExtraRenderAction();

    let scopedActions: QueryActionComponent[] = [];
    if (app !== undefined) {
      scopedActions = RowActionComponents.getScopedExtraRenderAction(app);
    }

    return [...unscopedActions, ...scopedActions]
      .map((action, index) =>
        action({
          query,
          queries,
          timeRange: data?.timeRange,
          onAddQuery: addQuery,
          dataSource: dsSettings,
          key: index,
        })
      )
      .filter(Boolean);
  }, [query, app, queries, data?.timeRange, addQuery, dsSettings]);

  const telemetryComponents = useAdaptiveTelemetryComponents(query);
  const extensionActions = useQueryEditorRowExtensionActions({
    query,
    queries,
    dataSource: dsSettings,
    app,
    timeRange: data?.timeRange,
  });

  if (cardType === QueryEditorType.Expression) {
    return null;
  }

  if (extraActions.length === 0 && !telemetryComponents && extensionActions.length === 0) {
    return null;
  }

  return (
    <Stack gap={0.5} alignItems="center">
      {extraActions}
      {telemetryComponents}
      {extensionActions}
    </Stack>
  );
}

/**
 * Hook to render adaptive telemetry plugin extensions.
 * Matches legacy AdaptiveTelemetryQueryActions component behavior.
 */
function useAdaptiveTelemetryComponents(query: DataQuery | null) {
  const { isLoading, components } = usePluginComponents<PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context>({
    extensionPointId: PluginExtensionPoints.QueryEditorRowAdaptiveTelemetryV1,
  });

  if (isLoading || !components.length || !query) {
    return null;
  }

  try {
    return renderLimitedComponents({
      props: { query, contextHints: ['queryeditorrow', 'header'] },
      components,
      limit: 1,
      pluginId: /grafana-adaptive.*/,
    });
  } catch (error) {
    console.error('Failed to render adaptive telemetry components:', error);
    return null;
  }
}
