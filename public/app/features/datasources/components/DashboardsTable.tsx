import React from 'react';

import { Button, Icon } from '@grafana/ui';
import { PluginDashboard } from 'app/types';

export interface Props {
  // List of plugin dashboards to show in the table
  dashboards: PluginDashboard[];
  // Callback used when the user clicks on importing a dashboard
  onImport: (dashboard: PluginDashboard, overwrite: boolean) => void;
  // Callback used when the user clicks on removing a dashboard
  onRemove: (dashboard: PluginDashboard) => void;
}

export function DashboardsTable({ dashboards, onImport, onRemove }: Props) {
  function buttonText(dashboard: PluginDashboard) {
    return dashboard.revision !== dashboard.importedRevision ? 'Update' : 'Re-import';
  }

  return (
    <table className="filter-table">
      <tbody>
        {dashboards.map((dashboard, index) => {
          return (
            <tr key={`${dashboard.dashboardId}-${index}`}>
              <td className="width-1">
                <Icon name="apps" />
              </td>
              <td>
                {dashboard.imported ? (
                  <a href={dashboard.importedUrl}>{dashboard.title}</a>
                ) : (
                  <span>{dashboard.title}</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {!dashboard.imported ? (
                  <Button variant="secondary" size="sm" onClick={() => onImport(dashboard, false)}>
                    Import
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => onImport(dashboard, true)}>
                    {buttonText(dashboard)}
                  </Button>
                )}
                {dashboard.imported && (
                  <Button
                    aria-label="Delete dashboard"
                    icon="trash-alt"
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove(dashboard)}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default DashboardsTable;
