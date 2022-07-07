import React from 'react';
import { connect } from 'react-redux';
import { useAsync } from 'react-use';

import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

type Settings = { [key: string]: { [key: string]: string } };

interface Props {
  navModel: NavModel;
}

function AdminSettings({ navModel }: Props) {
  const { loading, value: settings } = useAsync(
    () => getBackendSrv().get('/api/admin/settings') as Promise<Settings>,
    []
  );

  return (
    <Page navModel={navModel}>
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

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'server-settings'),
});

export default connect(mapStateToProps)(AdminSettings);
