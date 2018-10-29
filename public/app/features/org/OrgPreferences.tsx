import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import Tooltip from '../../core/components/Tooltip/Tooltip';
import SimplePicker from '../../core/components/Picker/SimplePicker';
import { DashboardAcl, OrganizationPreferences } from 'app/types';
import {
  setOrganizationHomeDashboard,
  setOrganizationTheme,
  setOrganizationTimezone,
  updateOrganizationPreferences,
} from './state/actions';

export interface Props {
  preferences: OrganizationPreferences;
  starredDashboards: DashboardAcl[];
  setOrganizationHomeDashboard: typeof setOrganizationHomeDashboard;
  setOrganizationTheme: typeof setOrganizationTheme;
  setOrganizationTimezone: typeof setOrganizationTimezone;
  updateOrganizationPreferences: typeof updateOrganizationPreferences;
}

const themes = [{ value: '', text: 'Default' }, { value: 'dark', text: 'Dark' }, { value: 'light', text: 'Light' }];

const timezones = [
  { value: '', text: 'Default' },
  { value: 'browser', text: 'Local browser time' },
  { value: 'utc', text: 'UTC' },
];

export class OrgPreferences extends PureComponent<Props> {
  onSubmitForm = event => {
    event.preventDefault();
    this.props.updateOrganizationPreferences();
  };

  render() {
    const {
      preferences,
      starredDashboards,
      setOrganizationHomeDashboard,
      setOrganizationTimezone,
      setOrganizationTheme,
    } = this.props;

    starredDashboards.unshift({ id: 0, title: 'Default' });

    return (
      <form className="section gf-form-group" onSubmit={this.onSubmitForm}>
        <h3 className="page-heading">Preferences</h3>
        <div className="gf-form">
          <span className="gf-form-label width-11">UI Theme</span>
          <SimplePicker
            defaultValue={themes.find(theme => theme.value === preferences.theme)}
            options={themes}
            getOptionValue={i => i.value}
            getOptionLabel={i => i.text}
            onSelected={theme => setOrganizationTheme(theme.value)}
            width={20}
          />
        </div>
        <div className="gf-form">
          <span className="gf-form-label width-11">
            Home Dashboard
            <Tooltip
              className="gf-form-help-icon gf-form-help-icon--right-normal"
              placement="right"
              content="Not finding dashboard you want? Star it first, then it should appear in this select box."
            >
              <i className="fa fa-info-circle" />
            </Tooltip>
          </span>
          <SimplePicker
            defaultValue={starredDashboards.find(dashboard => dashboard.id === preferences.homeDashboardId)}
            getOptionValue={i => i.id}
            getOptionLabel={i => i.title}
            onSelected={(dashboard: DashboardAcl) => setOrganizationHomeDashboard(dashboard.id)}
            options={starredDashboards}
            placeholder="Chose default dashboard"
            width={20}
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label width-11">Timezone</label>
          <SimplePicker
            defaultValue={timezones.find(timezone => timezone.value === preferences.timezone)}
            getOptionValue={i => i.value}
            getOptionLabel={i => i.text}
            onSelected={timezone => setOrganizationTimezone(timezone.value)}
            options={timezones}
            width={20}
          />
        </div>
        <div className="gf-form-button-row">
          <button type="submit" className="btn btn-success">
            Save
          </button>
        </div>
      </form>
    );
  }
}

function mapStateToProps(state) {
  return {
    preferences: state.organization.preferences,
    starredDashboards: state.organization.starredDashboards,
  };
}

const mapDispatchToProps = {
  setOrganizationHomeDashboard,
  setOrganizationTimezone,
  setOrganizationTheme,
  updateOrganizationPreferences,
};

export default connect(mapStateToProps, mapDispatchToProps)(OrgPreferences);
