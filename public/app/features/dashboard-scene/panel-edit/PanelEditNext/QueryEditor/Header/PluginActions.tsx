import { useMemo } from 'react';

import { CoreApp, PluginExtensionPoints, PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Stack } from '@grafana/ui';
import { QueryActionComponent, RowActionComponents } from 'app/features/query/components/QueryActionComponent';

import { QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';

interface PluginActionsProps {
  app?: CoreApp;
}

/**
 * Renders plugin-provided icon buttons (extra actions + adaptive telemetry)
 * directly in the header, outside of the actions dropdown menu.
 *
 * These are controlled by plugins and rendered as icon buttons, so they
 * need to live at the header level rather than inside a menu.
 */
export function PluginActions({ app }: PluginActionsProps) {
  const { queries, data } = useQueryRunnerContext();
  const { addQuery } = useActionsContext();
  const { selectedQuery, selectedQueryDsData, cardType } = useQueryEditorUIContext();

  const extraActions = useMemo(() => {
    if (!selectedQuery) {
      return [];
    }

    const unscopedActions = RowActionComponents.getAllExtraRenderAction();

    let scopedActions: QueryActionComponent[] = [];
    if (app !== undefined) {
      scopedActions = RowActionComponents.getScopedExtraRenderAction(app);
    }

    return [...unscopedActions, ...scopedActions]
      .map((action, index) =>
        action({
          query: selectedQuery,
          queries,
          timeRange: data?.timeRange,
          onAddQuery: addQuery,
          dataSource: selectedQueryDsData?.dsSettings,
          key: index,
        })
      )
      .filter(Boolean);
  }, [selectedQuery, app, queries, data?.timeRange, addQuery, selectedQueryDsData?.dsSettings]);

  const telemetryComponents = useAdaptiveTelemetryComponents(selectedQuery);

  if (!selectedQuery || cardType === QueryEditorType.Expression) {
    return null;
  }

  if (extraActions.length === 0 && !telemetryComponents) {
    return null;
  }

  return (
    <Stack gap={0.5} alignItems="center">
      {extraActions}
      {telemetryComponents}
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
