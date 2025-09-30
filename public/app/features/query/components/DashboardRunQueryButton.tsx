import { useState } from 'react';

import { DataQuery } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';

interface Props {
  queries: DataQuery[];
  rootDatasourceUid?: string;
  disabled?: boolean;
}

/**
 * Dashboard-specific run query button that handles running queries
 * in dashboard panel edit context
 */
export function DashboardRunQueryButton({ queries, rootDatasourceUid, disabled = false }: Props) {
  const [isRunning, setIsRunning] = useState(false);

  const runQuery = async () => {
    if (disabled || queries.length === 0) {
      return;
    }

    setIsRunning(true);

    try {
      const searchParams = locationService.getSearchObject();
      const editPanelId = searchParams.editPanel;
      
      if (!editPanelId) {
        console.warn('No panel being edited, cannot run query');
        return;
      }

      const dashboard = getDashboardSrv().getCurrent();
      if (!dashboard) {
        console.warn('No current dashboard found');
        return;
      }

      const panelId = typeof editPanelId === 'string' ? parseInt(editPanelId, 10) : Number(editPanelId);
      const panel = dashboard.getPanelById(panelId);
      if (!panel) {
        console.warn('Panel not found:', editPanelId);
        return;
      }

      // Replace the panel's queries with the selected query from history
      if (queries.length > 0) {
        const newQuery = { ...queries[0] };
        
        // Ensure the query has the correct datasource reference
        if (!newQuery.datasource && panel.datasource) {
          newQuery.datasource = panel.datasource;
        }

        // If the datasource is different, we might need to update it
        if (rootDatasourceUid && panel.datasource?.uid !== rootDatasourceUid) {
          // Update the panel's datasource if needed
          panel.datasource = { uid: rootDatasourceUid, type: newQuery.datasource?.type || '' };
        }

        // Replace the first query or add if no queries exist
        const updatedTargets = [...panel.targets];
        if (updatedTargets.length > 0) {
          updatedTargets[0] = { ...newQuery, refId: updatedTargets[0].refId || 'A' };
        } else {
          updatedTargets.push({ ...newQuery, refId: 'A' });
        }

        // Update the panel with the new query
        const dataSource = newQuery.datasource || panel.datasource;
        if (dataSource) {
          panel.updateQueries({
            queries: updatedTargets,
            dataSource: dataSource,
          });
        } else {
          // Fallback: just update the targets directly
          panel.targets = updatedTargets;
        }

        // Run the query
        panel.refresh();

        reportInteraction('grafana_dashboard_query_history_run', {
          queryHistoryEnabled: config.queryHistoryEnabled,
          differentDataSource: rootDatasourceUid !== panel.datasource?.uid,
        });
      }
    } catch (error) {
      console.error('Error running query in dashboard context:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const isInvalid = disabled || queries.length === 0;

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={runQuery}
      disabled={isInvalid || isRunning}
      icon={isRunning ? 'spinner' : undefined}
    >
      {t('explore.run-query.run-query-button', 'Run query')}
    </Button>
  );
}
