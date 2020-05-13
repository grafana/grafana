import React, { PureComponent } from 'react';

import { InlineFormLabel, LegacyForms } from '@grafana/ui';
const { Select } = LegacyForms;

import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { getTimeZoneGroups, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

export interface Props {
  resourceUri: string;
}

export interface State {
  homeDashboardId: number;
  theme: string;
  timezone: string;
  dashboards: DashboardSearchHit[];
}

const themes = [
  { value: '', label: 'Default' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const grafanaTimeZones = [
  { value: '', label: 'Default' },
  { value: 'browser', label: 'Local browser time' },
  { value: 'utc', label: 'UTC' },
];

const timeZones = getTimeZoneGroups().reduce((tzs, group) => {
  const options = group.options.map(tz => ({ value: tz, label: tz }));
  tzs.push.apply(tzs, options);
  return tzs;
}, grafanaTimeZones);

export class SharedPreferences extends PureComponent<Props, State> {
  backendSrv = backendSrv;

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
    const prefs = await backendSrv.get(`/api/${this.props.resourceUri}/preferences`);
    const dashboards = await backendSrv.search({ starred: true });
    const defaultDashboardHit: DashboardSearchHit = {
      id: 0,
      title: 'Default',
      tags: [],
      type: '' as DashboardSearchItemType,
      uid: '',
      uri: '',
      url: '',
      folderId: 0,
      folderTitle: '',
      folderUid: '',
      folderUrl: '',
      isStarred: false,
      slug: '',
      items: [],
    };

    if (prefs.homeDashboardId > 0 && !dashboards.find(d => d.id === prefs.homeDashboardId)) {
      const missing = await backendSrv.search({ dashboardIds: [prefs.homeDashboardId] });
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

    await backendSrv.put(`/api/${this.props.resourceUri}/preferences`, {
      homeDashboardId,
      theme,
      timezone,
    });
    window.location.reload();
  };

  onThemeChanged = (theme: SelectableValue<string>) => {
    if (!theme || typeof theme.value !== 'string') {
      return;
    }
    this.setState({ theme: theme.value });
  };

  onTimeZoneChanged = (timezone: SelectableValue<string>) => {
    if (!timezone || typeof timezone.value !== 'string') {
      return;
    }
    this.setState({ timezone: timezone.value });
  };

  onHomeDashboardChanged = (dashboardId: number) => {
    this.setState({ homeDashboardId: dashboardId });
  };

  getFullDashName = (dashboard: DashboardSearchHit) => {
    if (typeof dashboard.folderTitle === 'undefined' || dashboard.folderTitle === '') {
      return dashboard.title;
    }
    return dashboard.folderTitle + ' / ' + dashboard.title;
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
            onChange={this.onThemeChanged}
            width={20}
          />
        </div>
        <div className="gf-form">
          <InlineFormLabel
            width={11}
            tooltip="Not finding dashboard you want? Star it first, then it should appear in this select box."
          >
            Home Dashboard
          </InlineFormLabel>
          <Select
            value={dashboards.find(dashboard => dashboard.id === homeDashboardId)}
            getOptionValue={i => i.id}
            getOptionLabel={this.getFullDashName}
            onChange={(dashboard: DashboardSearchHit) => this.onHomeDashboardChanged(dashboard.id)}
            options={dashboards}
            placeholder="Choose default dashboard"
            width={20}
          />
        </div>
        <div className="gf-form" aria-label={selectors.components.TimeZonePicker.container}>
          <label className="gf-form-label width-11">Timezone</label>
          <Select
            isSearchable={true}
            value={timeZones.find(item => item.value === timezone)}
            onChange={this.onTimeZoneChanged}
            options={timeZones}
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
