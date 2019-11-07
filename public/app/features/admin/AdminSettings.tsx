import React from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';

import { getBackendSrv } from '@grafana/runtime';
import { NavModel } from '@grafana/data';

import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';

const backendSrv = getBackendSrv();

type Settings = { [key: string]: { [key: string]: string } };

interface Props {
  navModel: NavModel;
}

interface State {
  settings: Settings;
  isLoading: boolean;
}

export class AdminSettings extends React.PureComponent<Props, State> {
  state: State = {
    settings: {},
    isLoading: true,
  };

  async componentDidMount() {
    const settings: Settings = await backendSrv.get('/api/admin/settings');
    this.setState({
      settings,
      isLoading: false,
    });
  }

  render() {
    const { settings, isLoading } = this.state;
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          <div className="grafana-info-box span8" style={{ margin: '20px 0 25px 0' }}>
            These system settings are defined in grafana.ini or custom.ini (or overridden in ENV variables). To change
            these you currently need to restart grafana.
          </div>

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
                      <td>{settingValue}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'server-settings'),
});

export default hot(module)(connect(mapStateToProps)(AdminSettings));
