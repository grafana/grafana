import React, { FC } from 'react';
import { PluginDashboard } from '../../types';
import { Button, Icon, Badge } from '@grafana/ui';

export interface Props {
  dashboards: PluginDashboard[];
  onImport: (dashboard: PluginDashboard, overwrite: boolean) => void;
  onRemove: (dashboard: PluginDashboard) => void;
}

const DashboardsTable: FC<Props> = ({ dashboards, onImport, onRemove }) => {
  function renderDashboardButtons(dashboard: PluginDashboard) {
    if (!dashboard.imported) {
      // won't be returned from api if not compatible
      return (
        <Button variant="secondary" size="sm" onClick={() => onImport(dashboard, false)}>
          Import
        </Button>
      );
    }

    if (dashboard.importedCompatible) {
      if (dashboard.compatible) {
        return (
          <Button variant="secondary" size="sm" onClick={() => onImport(dashboard, true)}>
            {dashboard.revision !== dashboard.importedRevision ? 'Update' : 'Re-import'}
          </Button>
        );
      }
      //dont offer re-import or update as the new version isn't compatible
      return <></>;
    } else {
      const incompatibe = (
        <Badge
          text="Incompatible"
          icon="exclamation-triangle"
          color="red"
          tooltip="This dashboard is not compatible with this version of Grafana"
          style={{ marginRight: '5px' }}
        />
      );
      if (dashboard.compatible) {
        return (
          <>
            {incompatibe}
            <Button variant="secondary" size="sm" onClick={() => onImport(dashboard, true)}>
              Update
            </Button>
          </>
        );
      }
      //
      return incompatibe;
    }
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
                {renderDashboardButtons(dashboard)}
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
