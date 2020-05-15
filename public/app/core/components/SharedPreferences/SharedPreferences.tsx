import React, { PureComponent } from 'react';

import { TimeZonePicker, Select, Form, Legend, Field, InputControl, Button } from '@grafana/ui';

import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { getTimeZoneGroups } from '@grafana/data';
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

interface FormDTO {
  homeDashboardId: number;
  theme: string;
  timezone: string;
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

  onSubmitForm = async (values: FormDTO) => {
    const { homeDashboardId, theme, timezone } = values;

    await backendSrv.put(`/api/${this.props.resourceUri}/preferences`, {
      homeDashboardId,
      theme,
      timezone,
    });
    window.location.reload();
  };

  getFullDashName = (dashboard: DashboardSearchHit) => {
    if (typeof dashboard.folderTitle === 'undefined' || dashboard.folderTitle === '') {
      return dashboard.title;
    }
    return dashboard.folderTitle + ' / ' + dashboard.title;
  };

  render() {
    const { theme, timezone, homeDashboardId, dashboards } = this.state;
    const defaultValues = {
      theme,
      timezone,
      homeDashboardId,
    };

    return (
      <Form defaultValues={defaultValues} onSubmit={this.onSubmitForm}>
        {({ register, errors, control }) => (
          <>
            <Legend>Preferences</Legend>
            <Field label="UI Theme">
              <InputControl name="theme" control={control} options={themes} isSearchable={false} as={Select} />
            </Field>
            <Field
              label="Home dashboard"
              description="Not finding dashboard you want? Star it first, then it should appear in this select box."
            >
              <InputControl
                placeholder="Choose default dashboard"
                name="homeDashboardId"
                options={dashboards.map(dash => ({ value: dash.id, label: this.getFullDashName(dash) }))}
                control={control}
                as={Select}
              />
            </Field>
            <Field label="Timezone" aria-label={selectors.components.TimeZonePicker.container}>
              <InputControl options={timeZones} name="timezone" control={control} as={Select} />
            </Field>
            <Button type="submit">Save</Button>
          </>
        )}
      </Form>
    );
  }
}

export default SharedPreferences;
