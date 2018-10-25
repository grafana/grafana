import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import PageHeader from '../../core/components/PageHeader/PageHeader';
import { loadOrganisation } from './state/actions';
import { NavModel, Organisation, OrganisationPreferences, StoreState } from 'app/types';
import { getNavModel } from '../../core/selectors/navModel';

export interface Props {
  navModel: NavModel;
  organisation: Organisation;
  preferences: OrganisationPreferences;
  loadOrganisation: typeof loadOrganisation;
}

interface State {
  orgName: string;
  hasSet: boolean;
}

export class OrgDetailsPage extends PureComponent<Props, State> {
  state = {
    orgName: '',
    hasSet: false,
  };

  async componentDidMount() {
    await this.props.loadOrganisation();
  }

  onOrgNameChange = event => {
    this.setState({
      orgName: event.target.value,
    });
  };

  onSubmitForm = event => {};

  render() {
    const { navModel, preferences } = this.props;

    const themes: any = [
      { value: '', text: 'Default' },
      { value: 'dark', text: 'Dark' },
      { value: 'light', text: 'Light' },
    ];

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h3 className="page-sub-heading">Organisation profile</h3>
          <form name="orgForm" className="gf-form-group" onSubmit={this.onSubmitForm}>
            <div className="gf-form-inline">
              <div className="gf-form max-width-28">
                <span className="gf-form-label">Organization name</span>
                <input
                  className="gf-form-input"
                  type="text"
                  onChange={this.onOrgNameChange}
                  value={this.state.orgName}
                />
              </div>
            </div>

            <div className="gf-form-button-row">
              <button type="submit" className="btn btn-success">
                Save
              </button>
            </div>
          </form>
          <form name="ctrl.prefsForm" className="section gf-form-group">
            <h3 className="page-heading">Preferences</h3>

            <div className="gf-form">
              <span className="gf-form-label width-11">UI Theme</span>
              <div className="gf-form-select-wrapper max-width-20">
                <select className="gf-form-input" value={preferences.theme}>
                  {themes.map((theme, index) => {
                    return (
                      <option key={`${theme.value}-${index}`} value={theme.value}>
                        {theme.text}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="gf-form">
              <span className="gf-form-label width-11">
                Home Dashboard
                {/*<info-popover mode="right-normal">*/}
                {/*Not finding dashboard you want? Star it first, then it should appear in this select box.*/}
                {/*</info-popover>*/}
              </span>
              {/*<dashboard-selector className="gf-form-select-wrapper max-width-20" model="ctrl.prefs.homeDashboardId" />*/}
            </div>

            <div className="gf-form">
              <label className="gf-form-label width-11">Timezone</label>
              <div className="gf-form-select-wrapper max-width-20">
                <select className="gf-form-input" ng-model="ctrl.prefs.timezone" />
              </div>
            </div>

            <div className="gf-form-button-row">
              <button type="submit" className="btn btn-success" ng-click="ctrl.updatePrefs()">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'org-settings'),
    organisation: state.organisation.organisation,
    preferences: state.organisation.preferences,
  };
}

const mapDispatchToProps = {
  loadOrganisation,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage));
