import React, { PureComponent } from 'react';

import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';

import { DashboardSearchHit } from 'app/types';

export interface Props {
  resourceUri: string;
}

export interface State {
  homeDashboardId: number;
  theme: string;
  timezone: string;
  dashboards: DashboardSearchHit[];
}

const themes = [{ value: '', text: 'Default' }, { value: 'dark', text: 'Dark' }, { value: 'light', text: 'Light' }];

const timezones = [
  { value: '', text: 'Default' },
  { value: 'browser', text: 'Local browser time' },
  { value: 'utc', text: 'UTC' },
];

export class SharedPreferences extends PureComponent<Props, State> {
  backendSrv: BackendSrv = getBackendSrv();

  constructor(props) {
    super(props);

    this.state = {
      homeDashboardId: 0,
      theme: '',
      timezone: '',
      dashboards: [],
    };
  }

  async componentDidMount() {
    const prefs = await this.backendSrv.get(`/api/${this.props.resourceUri}/preferences`);
    const dashboards = await this.backendSrv.search({ starred: true });

    if (prefs.homeDashboardId > 0 && !dashboards.find(d => d.id === prefs.homeDashboardId)) {
      const missing = await this.backendSrv.search({ dashboardIds: [prefs.homeDashboardId] });
      if (missing && missing.length > 0) {
        dashboards.push(missing[0]);
      }
    }

    this.setState({
      homeDashboardId: prefs.homeDashboardId,
      theme: prefs.theme,
      timezone: prefs.timezone,
      dashboards: [{ id: 0, title: 'Default', tags: [], type: '', uid: '', uri: '', url: '' }, ...dashboards],
    });
  }

  onSubmitForm = async event => {
    event.preventDefault();

    const { homeDashboardId, theme, timezone } = this.state;

    await this.backendSrv.put(`/api/${this.props.resourceUri}/preferences`, {
      homeDashboardId,
      theme,
      timezone,
    });
    window.location.reload();
  };

  onThemeChanged = (theme: string) => {
    this.setState({ theme });
  };

  onTimeZoneChanged = (timezone: string) => {
    this.setState({ timezone });
  };

  onHomeDashboardChanged = (dashboardId: number) => {
    this.setState({ homeDashboardId: dashboardId });
  };

  render() {
    const { theme, timezone, homeDashboardId, dashboards } = this.state;

    return (
      <form className="section gf-form-group" onSubmit={this.onSubmitForm}>
        <h3 className="page-heading">Preferences</h3>
        <div className="gf-form">
          <span className="gf-form-label width-11">UI Theme</span>
          <SimplePicker
            value={themes.find(item => item.value === theme)}
            options={themes}
            getOptionValue={i => i.value}
            getOptionLabel={i => i.text}
            onSelected={theme => this.onThemeChanged(theme.value)}
            width={20}
          />
        </div>
        <div className="gf-form">
          <Label
            width={11}
            tooltip="Not finding dashboard you want? Star it first, then it should appear in this select box."
          >
            Home Dashboard
          </Label>
          <SimplePicker
            value={dashboards.find(dashboard => dashboard.id === homeDashboardId)}
            getOptionValue={i => i.id}
            getOptionLabel={i => i.title}
            onSelected={(dashboard: DashboardSearchHit) => this.onHomeDashboardChanged(dashboard.id)}
            options={dashboards}
            placeholder="Chose default dashboard"
            width={20}
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label width-11">Timezone</label>
          <SimplePicker
            value={timezones.find(item => item.value === timezone)}
            getOptionValue={i => i.value}
            getOptionLabel={i => i.text}
            onSelected={timezone => this.onTimeZoneChanged(timezone.value)}
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

export default SharedPreferences;
