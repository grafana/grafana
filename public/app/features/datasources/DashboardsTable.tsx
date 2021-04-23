import React, { FC } from 'react';
import { PluginDashboard } from '../../types';
import { Button, Icon } from '@grafana/ui';

export interface Props {
  dashboards: PluginDashboard[];
  onImport: (dashboard: PluginDashboard, overwrite: boolean) => void;
  onRemove: (dashboard: PluginDashboard) => void;
}

const DashboardsTable: FC<Props> = ({ dashboards, onImport, onRemove }) => {
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
                  <Button icon="trash-alt" variant="destructive" size="sm" onClick={() => onRemove(dashboard)} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default DashboardsTable;
