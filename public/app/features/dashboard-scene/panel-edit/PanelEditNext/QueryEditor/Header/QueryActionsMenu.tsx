import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  CoreApp,
  GrafanaTheme2,
  PluginExtensionPoints,
  PluginExtensionQueryEditorRowAdaptiveTelemetryV1Context,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { QueryActionComponent, RowActionComponents } from 'app/features/query/components/QueryActionComponent';

import { QueryEditorType } from '../../constants';
import {
  useActionsContext,
  useDatasourceContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from '../QueryEditorContext';

interface QueryActionsMenuProps {
  app?: CoreApp;
}

/**
 * Actions menu for queries and expressions.
 * Handles duplicate, hide/show, plugin actions, help, and delete.
 */
export function QueryActionsMenu({ app }: QueryActionsMenuProps) {
  const { dsSettings } = useDatasourceContext();
  const { queries, data } = useQueryRunnerContext();
  const { duplicateQuery, deleteQuery, toggleQueryHide, addQuery } = useActionsContext();
  const {
    selectedQuery,
    selectedQueryDsData,
    selectedQueryDsLoading,
    showingDatasourceHelp,
    toggleDatasourceHelp,
    cardType,
  } = useQueryEditorUIContext();
  const { isEditingQuery } = useQueryLibraryContext();

  const styles = useStyles2(getStyles);

  // Extra actions from plugins
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
          dataSource: dsSettings,
          key: index,
        })
      )
      .filter(Boolean);
  }, [selectedQuery, queries, data, app, dsSettings, addQuery]);

  // Adaptive telemetry plugin extensions
  const telemetryComponents = useAdaptiveTelemetryComponents(selectedQuery);

  if (!selectedQuery) {
    return null;
  }

  const isExpression = cardType === QueryEditorType.Expression;
  const isHidden = !!selectedQuery.hide;
  const hasEditorHelp = !selectedQueryDsLoading && selectedQueryDsData?.datasource?.components?.QueryEditorHelp;

  return (
    <Dropdown
      overlay={
        <Menu>
          {!isEditingQuery && (
            <Menu.Item
              label={t('query-editor.action.duplicate', 'Duplicate query')}
              icon="copy"
              onClick={() => duplicateQuery(selectedQuery.refId)}
            />
          )}

          <Menu.Item
            label={
              isHidden ? t('query-editor.action.show', 'Show response') : t('query-editor.action.hide', 'Hide response')
            }
            icon={isHidden ? 'eye-slash' : 'eye'}
            onClick={() => toggleQueryHide(selectedQuery.refId)}
            data-testid={selectors.components.QueryEditorRow.actionButton('Hide response')}
          />

          {/* Extra actions from plugins */}
          {(extraActions.length > 0 || telemetryComponents) && (
            <>
              <Menu.Divider />
              {extraActions.map((action, i) => (
                <div key={i} className={styles.extraAction}>
                  {action}
                </div>
              ))}
              {telemetryComponents && <div className={styles.extraAction}>{telemetryComponents}</div>}
            </>
          )}

          {/* Data source help (queries only, not expressions) */}
          {hasEditorHelp && !isExpression && (
            <>
              <Menu.Divider />
              <Menu.Item
                label={
                  showingDatasourceHelp
                    ? t('query-editor.action.hide-help', 'Hide data source help')
                    : t('query-editor.action.show-help', 'Show data source help')
                }
                icon="question-circle"
                onClick={toggleDatasourceHelp}
                active={showingDatasourceHelp}
              />
            </>
          )}

          {!isEditingQuery && (
            <>
              <Menu.Divider />
              <Menu.Item
                label={t('query-editor.action.remove-query', 'Remove query')}
                icon="trash-alt"
                onClick={() => deleteQuery(selectedQuery.refId)}
                destructive
              />
            </>
          )}
        </Menu>
      }
      placement="bottom-end"
    >
      <Button
        size="sm"
        fill="text"
        icon="ellipsis-v"
        variant="secondary"
        aria-label={t('query-editor.action.more-actions', 'More query actions')}
        tooltip={t('query-editor.action.more-actions', 'More query actions')}
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  extraAction: css({
    padding: theme.spacing(0.5, 1),
  }),
});

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
