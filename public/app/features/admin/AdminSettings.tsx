import React from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

type Settings = { [key: string]: { [key: string]: string } };

function AdminSettings() {
  const { loading, value: settings } = useAsync(() => getBackendSrv().get<Settings>('/api/admin/settings'), []);

  return (
    <Page navId="server-settings">
      <Page.Contents isLoading={loading}>
        <div className="grafana-info-box span8" style={{ margin: '20px 0 25px 0' }}>
          These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change
          these you currently need to restart Grafana.
        </div>

        {settings && (
          <table className="filter-table">
            <tbody>
              {Object.entries(settings).map(([sectionName, sectionSettings], i) => (
                <React.Fragment key={`section-${i}`}>
                  <tr>
                    <td className="admin-settings-section">{sectionName}</td>
                    <td />
                  </tr>
                  {Object.entries(sectionSettings).map(([settingName, settingValue], j) => (
                    <tr key={`property-${j}`}>
                      <td style={{ paddingLeft: '25px' }}>{settingName}</td>
                      <td style={{ whiteSpace: 'break-spaces' }}>{settingValue}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Page.Contents>
    </Page>
  );
}

export default AdminSettings;
