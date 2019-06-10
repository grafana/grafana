import React, { PureComponent } from 'react';

import { FormLabel, Select } from '@grafana/ui';

import { DashboardSearchHit, DashboardSearchHitType } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface Props {
  resourceUri: string;
}

export interface State {
  homeDashboardId: number;
  theme: string;
  timezone: string;
  dashboards: DashboardSearchHit[];
}

const themes = [{ value: '', label: 'Default' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }];

const timezones = [
  { value: '', label: 'Default' },
  { value: 'browser', label: 'Local browser time' },
  { value: 'utc', label: 'UTC' },
];

export class SharedPreferences extends PureComponent<Props, State> {
  backendSrv = getBackendSrv();

  constructor(props: Props) {
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
    const defaultDashboardHit: DashboardSearchHit = {
      id: 0,
      title: 'Default',
      tags: [],
      type: '' as DashboardSearchHitType,
      uid: '',
      uri: '',
      url: '',
      folderId: 0,
      folderTitle: '',
      folderUid: '',
      folderUrl: '',
      isStarred: false,
      slug: '',
    };

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
      dashboards: [defaultDashboardHit, ...dashboards],
    });
  }

  onSubmitForm = async (event: React.SyntheticEvent) => {
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
          <Select
            isSearchable={false}
            value={themes.find(item => item.value === theme)}
            options={themes}
            onChange={theme => this.onThemeChanged(theme.value)}
            width={20}
          />
        </div>
        <div className="gf-form">
          <FormLabel
            width={11}
            tooltip="Not finding dashboard you want? Star it first, then it should appear in this select box."
          >
            Home Dashboard
          </FormLabel>
          <Select
            value={dashboards.find(dashboard => dashboard.id === homeDashboardId)}
            getOptionValue={i => i.id}
            getOptionLabel={i => i.title}
            onChange={(dashboard: DashboardSearchHit) => this.onHomeDashboardChanged(dashboard.id)}
            options={dashboards}
            placeholder="Choose default dashboard"
            width={20}
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label width-11">Timezone</label>
          <Select
            isSearchable={false}
            value={timezones.find(item => item.value === timezone)}
            onChange={timezone => this.onTimeZoneChanged(timezone.value)}
            options={timezones}
            width={20}
          />
        </div>
        <div className="gf-form-button-row">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    );
  }
}

export default SharedPreferences;
