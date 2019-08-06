import React, { FC } from 'react';
import { PluginDashboard } from '../../types';

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
                <i className="gicon gicon-dashboard" />
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
                  <button className="btn btn-secondary btn-small" onClick={() => onImport(dashboard, false)}>
                    Import
                  </button>
                ) : (
                  <button className="btn btn-secondary btn-small" onClick={() => onImport(dashboard, true)}>
                    {buttonText(dashboard)}
                  </button>
                )}
                {dashboard.imported && (
                  <button className="btn btn-danger btn-small" onClick={() => onRemove(dashboard)}>
                    <i className="fa fa-trash" />
                  </button>
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
