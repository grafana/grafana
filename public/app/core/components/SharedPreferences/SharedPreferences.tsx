import React, { FC, useState } from 'react';

import { Select, Form, Legend, Field, InputControl, Button, RadioButtonGroup } from '@grafana/ui';

import { DashboardSearchHit, DashboardSearchItemType } from 'app/features/search/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { getTimeZoneGroups } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';

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

const getFullDashName = (dashboard: DashboardSearchHit) => {
  if (typeof dashboard.folderTitle === 'undefined' || dashboard.folderTitle === '') {
    return dashboard.title;
  }
  return dashboard.folderTitle + ' / ' + dashboard.title;
};

const onSubmitForm = async (values: FormDTO, resourceUri: string) => {
  const { homeDashboardId, theme, timezone } = values;

  await backendSrv.put(`/api/${resourceUri}/preferences`, {
    homeDashboardId,
    theme,
    timezone,
  });
  window.location.reload();
};

const getPreferences = async (resourceUri: string) => {
  const prefs = await getBackendSrv().get(`/api/${resourceUri}/preferences`);
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

  return {
    homeDashboardId: prefs.homeDashboardId,
    theme: prefs.theme,
    timezone: prefs.timezone,
    dashboards: [defaultDashboardHit, ...dashboards],
  };
};
export const SharedPreferences: FC<Props> = ({ resourceUri }) => {
  const [initialValues, setIntialValues] = useState<State>(undefined);
  const [dashboards, setDashboards] = useState<DashboardSearchHit[]>([]);

  useAsync(async () => {
    const prefs = await getPreferences(resourceUri);
    const { dashboards } = prefs;
    setIntialValues(prefs);
    setDashboards(dashboards);
  }, []);

  return initialValues ? (
    <Form
      defaultValues={initialValues}
      onSubmit={(values: FormDTO) => onSubmitForm(values, resourceUri)}
      validateFieldsOnMount={['theme']}
      validateOnMount
    >
      {({ control }) => (
        <>
          <Legend>Preferences</Legend>
          <Field label="UI Theme">
            <InputControl name="theme" control={control} options={themes} as={RadioButtonGroup} />
          </Field>
          <Field
            label="Home dashboard"
            description="Not finding dashboard you want? Star it first, then it should appear in this select box."
          >
            <InputControl
              placeholder="Choose default dashboard"
              name="homeDashboardId"
              options={dashboards.map(dash => ({ value: dash.id, label: getFullDashName(dash) }))}
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
  ) : (
    <></>
  );
};

export default SharedPreferences;
