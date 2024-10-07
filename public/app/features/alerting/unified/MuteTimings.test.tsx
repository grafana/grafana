import { InitialEntry } from 'history';
import { last } from 'lodash';
import { ReactNode } from 'react';
import { Route } from 'react-router';
import { render, screen, userEvent, within } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  setAlertmanagerConfig,
  setGrafanaAlertmanagerConfig,
} from 'app/features/alerting/unified/mocks/server/configure';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import {
  TIME_INTERVAL_NAME_FILE_PROVISIONED,
  TIME_INTERVAL_NAME_HAPPY_PATH,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import EditMuteTimingPage from './components/mute-timings/EditMuteTiming';
import NewMuteTimingPage from './components/mute-timings/NewMuteTiming';
import { grantUserPermissions, mockDataSource } from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

const indexPageText = 'redirected routes page';
const renderMuteTimings = (component: ReactNode, location?: InitialEntry) => {
  render(
    <>
      <Route path="/alerting/routes" exact>
        {indexPageText}
      </Route>
      {component}
    </>,
    { historyOptions: location ? { initialEntries: [location] } : undefined }
  );
};

const alertmanagerName = 'alertmanager';

const dataSources = {
  am: mockDataSource({
    name: alertmanagerName,
    uid: MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID,
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  form: byTestId('mute-timing-form'),
  nameField: byTestId('mute-timing-name'),

  startsAt: byTestId('mute-timing-starts-at'),
  endsAt: byTestId('mute-timing-ends-at'),
  addTimeRange: byRole('button', { name: /add another time range/i }),

  weekdays: byTestId('mute-timing-weekdays'),
  days: byTestId('mute-timing-days'),
  months: byTestId('mute-timing-months'),
  years: byTestId('mute-timing-years'),

  addInterval: byRole('button', { name: /add another time interval/i }),
  submitButton: byText(/submit/i),
};

const muteTimeInterval: MuteTimeInterval = {
  name: 'default-mute',
  time_intervals: [
    {
      times: [
        {
          start_time: '12:00',
          end_time: '24:00',
        },
      ],
      days_of_month: ['15', '-1'],
      months: ['august:december', 'march'],
    },
  ],
};
const muteTimeInterval2: MuteTimeInterval = {
  name: 'default-mute2',
  time_intervals: [
    {
      times: [
        {
          start_time: '12:00',
          end_time: '24:00',
        },
      ],
      days_of_month: ['15', '-1'],
      months: ['august:december', 'march'],
    },
  ],
};

/** Alertmanager config where time intervals are stored in `mute_time_intervals` property */
export const defaultConfig: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [{ name: 'default' }, { name: 'critical' }],
    route: {
      receiver: 'default',
      group_by: ['alertname'],
      routes: [
        {
          matchers: ['env=prod', 'region!=EU'],
          mute_time_intervals: [muteTimeInterval.name],
        },
      ],
    },
    templates: [],
    mute_time_intervals: [muteTimeInterval],
  },
  template_files: {},
};

/** Alertmanager config where time intervals are stored in `time_intervals` property */
const defaultConfigWithNewTimeIntervalsField: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [{ name: 'default' }, { name: 'critical' }],
    route: {
      receiver: 'default',
      group_by: ['alertname'],
      routes: [
        {
          matchers: ['env=prod', 'region!=EU'],
          mute_time_intervals: [muteTimeInterval.name],
        },
      ],
    },
    templates: [],
    time_intervals: [muteTimeInterval],
  },
  template_files: {},
};

/** Alertmanager config where time intervals are stored in both `time_intervals` and `mute_time_intervals` properties */
const defaultConfigWithBothTimeIntervalsField: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [{ name: 'default' }, { name: 'critical' }],
    route: {
      receiver: 'default',
      group_by: ['alertname'],
      routes: [
        {
          matchers: ['env=prod', 'region!=EU'],
          mute_time_intervals: [muteTimeInterval.name],
        },
      ],
    },
    templates: [],
    time_intervals: [muteTimeInterval],
    mute_time_intervals: [muteTimeInterval2],
  },
  template_files: {},
};

const expectedToHaveRedirectedToRoutesRoute = async () =>
  expect(await screen.findByText(indexPageText)).toBeInTheDocument();

const fillOutForm = async ({
  name,
  startsAt,
  endsAt,
  days,
  months,
  years,
}: {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  days?: string;
  months?: string;
  years?: string;
}) => {
  const user = userEvent.setup();
  name && (await user.type(ui.nameField.get(), name));
  startsAt && (await user.type(ui.startsAt.get(), startsAt));
  endsAt && (await user.type(ui.endsAt.get(), endsAt));
  days && (await user.type(ui.days.get(), days));
  months && (await user.type(ui.months.get(), months));
  years && (await user.type(ui.years.get(), years));
};

const saveMuteTiming = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByText(/save mute timing/i));
};

setupMswServer();

const getAlertmanagerConfigUpdate = async (requests: Request[]): Promise<AlertManagerCortexConfig> => {
  const alertmanagerUpdate = requests.find(
    (r) => r.url.match('/alertmanager/(.*)/config/api/v1/alert') && r.method === 'POST'
  );

  return alertmanagerUpdate!.clone().json();
};

describe('Mute timings', () => {
  beforeEach(() => {
    setupDataSources(dataSources.am);
    // FIXME: scope down
    grantUserPermissions(Object.values(AccessControlAction));

    setGrafanaAlertmanagerConfig(defaultConfig);
    setAlertmanagerConfig(defaultConfig);
  });

  it('creates a new mute timing, with mute_time_intervals in config', async () => {
    const capture = captureRequests();
    renderMuteTimings(<NewMuteTimingPage />);

    await screen.findByText(/add mute timing/i);

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:00',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();

    await expectedToHaveRedirectedToRoutesRoute();

    const requests = await capture;
    const alertmanagerUpdate = await getAlertmanagerConfigUpdate(requests);
    const lastAdded = last(alertmanagerUpdate.alertmanager_config.time_intervals);

    // Check that the last mute_time_interval is the one we just submitted via the form
    expect(lastAdded?.name).toEqual('maintenance period');
  });

  it('creates a new mute timing, with time_intervals in config', async () => {
    const capture = captureRequests();
    setAlertmanagerConfig(defaultConfigWithNewTimeIntervalsField);
    renderMuteTimings(<NewMuteTimingPage />, {
      search: `?alertmanager=${alertmanagerName}`,
    });

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:01',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();
    await expectedToHaveRedirectedToRoutesRoute();

    const requests = await capture;
    const alertmanagerUpdate = await getAlertmanagerConfigUpdate(requests);
    const lastAdded = last(alertmanagerUpdate.alertmanager_config.time_intervals);

    expect(lastAdded?.name).toEqual('maintenance period');
  });

  it('creates a new mute timing, with time_intervals and mute_time_intervals in config', async () => {
    setGrafanaAlertmanagerConfig(defaultConfigWithBothTimeIntervalsField);
    renderMuteTimings(<NewMuteTimingPage />, {
      search: `?alertmanager=${alertmanagerName}`,
    });

    expect(ui.nameField.get()).toBeInTheDocument();

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:00',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();
    await expectedToHaveRedirectedToRoutesRoute();
  });

  it('prepopulates the form when editing a mute timing', async () => {
    const capture = captureRequests();

    renderMuteTimings(<EditMuteTimingPage />, {
      search: `?muteName=${encodeURIComponent(muteTimeInterval.name)}`,
    });

    expect(await ui.nameField.find()).toBeInTheDocument();
    expect(ui.nameField.get()).toHaveValue(muteTimeInterval.name);
    expect(ui.months.get()).toHaveValue(muteTimeInterval.time_intervals[0].months?.join(', '));

    await userEvent.clear(ui.startsAt.getAll()?.[0]);
    await userEvent.clear(ui.endsAt.getAll()?.[0]);
    await userEvent.clear(ui.days.get());
    await userEvent.clear(ui.months.get());
    await userEvent.clear(ui.years.get());

    const monday = within(ui.weekdays.get()).getByText('Mon');
    await userEvent.click(monday);

    const formValues = {
      days: '-7:-1',
      months: '3, 6, 9, 12',
      years: '2021:2024',
    };

    await fillOutForm(formValues);

    await saveMuteTiming();
    await expectedToHaveRedirectedToRoutesRoute();

    const requests = await capture;
    const alertmanagerUpdate = await getAlertmanagerConfigUpdate(requests);
    const lastAdded = last(alertmanagerUpdate.alertmanager_config.mute_time_intervals);

    expect(lastAdded?.time_intervals[0]).toMatchObject({
      days_of_month: [formValues.days],
      months: formValues.months.split(', '),
      years: [formValues.years],
    });
  });

  it('form is invalid with duplicate mute timing name', async () => {
    renderMuteTimings(<NewMuteTimingPage />);

    await fillOutForm({ name: muteTimeInterval.name, days: '1' });

    await saveMuteTiming();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('replaces mute timings in routes when the mute timing name is changed', async () => {
    renderMuteTimings(<EditMuteTimingPage />, {
      search: `?muteName=${encodeURIComponent(muteTimeInterval.name)}`,
    });

    expect(await ui.nameField.find()).toBeInTheDocument();
    expect(ui.nameField.get()).toHaveValue(muteTimeInterval.name);

    await userEvent.clear(ui.nameField.get());
    await fillOutForm({ name: 'Lunch breaks' });
    await saveMuteTiming();

    await expectedToHaveRedirectedToRoutesRoute();
  });

  it('shows error when mute timing does not exist', async () => {
    renderMuteTimings(<EditMuteTimingPage />, {
      search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${'does not exist'}`,
    });

    expect(await screen.findByText(/No matching mute timing found/i)).toBeInTheDocument();
  });

  describe('alertingApiServer feature toggle', () => {
    beforeEach(() => {
      config.featureToggles.alertingApiServer = true;
    });

    it('allows creation of new mute timings', async () => {
      renderMuteTimings(<NewMuteTimingPage />);

      await fillOutForm({ name: 'a new mute timing' });

      await saveMuteTiming();
      await expectedToHaveRedirectedToRoutesRoute();
    });

    it('shows error when mute timing does not exist', async () => {
      renderMuteTimings(<EditMuteTimingPage />, {
        search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${TIME_INTERVAL_NAME_HAPPY_PATH + '_force_breakage'}`,
      });

      expect(await screen.findByText(/No matching mute timing found/i)).toBeInTheDocument();
    });

    it('loads edit form correctly and allows saving', async () => {
      renderMuteTimings(<EditMuteTimingPage />, {
        search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${TIME_INTERVAL_NAME_HAPPY_PATH}`,
      });

      await saveMuteTiming();
      await expectedToHaveRedirectedToRoutesRoute();
    });

    it('loads view form for provisioned interval', async () => {
      renderMuteTimings(<EditMuteTimingPage />, {
        search: `?muteName=${TIME_INTERVAL_NAME_FILE_PROVISIONED}`,
      });

      expect(await screen.findByText(/This mute timing cannot be edited through the UI/i)).toBeInTheDocument();
    });
  });
});
