import { InitialEntry } from 'history';
import { last } from 'lodash';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, userEvent, within } from 'test/test-utils';
import { byTestId } from 'testing-library-selector';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';
import { MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import {
  TIME_INTERVAL_NAME_FILE_PROVISIONED,
  TIME_INTERVAL_NAME_HAPPY_PATH,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import EditMuteTimingPage from './components/mute-timings/EditMuteTiming';
import NewMuteTimingPage from './components/mute-timings/NewMuteTiming';
import { defaultConfig, muteTimeInterval } from './components/mute-timings/mocks';
import { grantUserPermissions, mockDataSource } from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

const indexPageText = 'redirected routes page';
const Index = () => {
  return <div>{indexPageText}</div>;
};
const renderMuteTimings = (location?: InitialEntry) => {
  render(
    <Routes>
      <Route path={'/alerting/routes'} element={<Index />} />
      <Route path={'/alerting/routes/new'} element={<NewMuteTimingPage />} />
      <Route path={'/alerting/routes/edit'} element={<EditMuteTimingPage />} />
    </Routes>,
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
  nameField: byTestId('mute-timing-name'),

  startsAt: byTestId('mute-timing-starts-at'),
  endsAt: byTestId('mute-timing-ends-at'),

  weekdays: byTestId('mute-timing-weekdays'),
  days: byTestId('mute-timing-days'),
  months: byTestId('mute-timing-months'),
  years: byTestId('mute-timing-years'),
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

const expectToHaveRedirectedToRoutesRoute = async () =>
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
  await user.click(await screen.findByText(/save time interval/i));
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

    setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, defaultConfig);
    setAlertmanagerConfig(dataSources.am.uid, defaultConfig);

    // TODO: Add this at a higher level to ensure that no tests depend on others running first
    // Without this, the selected alertmanager in a previous test can affect the next, meaning tests
    // pass/fail depending on the order they are run/if they are focused
    window.localStorage.clear();
  });

  it('creates a new mute timing, with mute_time_intervals in config', async () => {
    const capture = captureRequests();
    renderMuteTimings({ pathname: '/alerting/routes/new', search: `?alertmanager=${dataSources.am.name}` });

    await screen.findByText(/add time interval/i);

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:00',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();

    await expectToHaveRedirectedToRoutesRoute();

    const requests = await capture;
    const alertmanagerUpdate = await getAlertmanagerConfigUpdate(requests);
    const lastAdded = last(alertmanagerUpdate.alertmanager_config.time_intervals);

    // Check that the last mute_time_interval is the one we just submitted via the form
    expect(lastAdded?.name).toEqual('maintenance period');
  });

  it('creates a new mute timing, with time_intervals in config', async () => {
    const capture = captureRequests();
    setAlertmanagerConfig(dataSources.am.uid, defaultConfigWithNewTimeIntervalsField);
    renderMuteTimings({ pathname: '/alerting/routes/new', search: `?alertmanager=${dataSources.am.name}` });

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:01',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();
    await expectToHaveRedirectedToRoutesRoute();

    const requests = await capture;
    const alertmanagerUpdate = await getAlertmanagerConfigUpdate(requests);
    const lastAdded = last(alertmanagerUpdate.alertmanager_config.time_intervals);

    expect(lastAdded?.name).toEqual('maintenance period');
  });

  it('creates a new mute timing, with time_intervals and mute_time_intervals in config', async () => {
    setAlertmanagerConfig(dataSources.am.uid, defaultConfigWithBothTimeIntervalsField);
    renderMuteTimings({ pathname: '/alerting/routes/new', search: `?alertmanager=${dataSources.am.name}` });

    expect(ui.nameField.get()).toBeInTheDocument();

    await fillOutForm({
      name: 'maintenance period',
      startsAt: '22:00',
      endsAt: '24:00',
      days: '-1',
      months: 'january, july',
    });

    await saveMuteTiming();
    await expectToHaveRedirectedToRoutesRoute();
  });

  it('prepopulates the form when editing a mute timing', async () => {
    const capture = captureRequests();
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?muteName=${encodeURIComponent(muteTimeInterval.name)}&alertmanager=${dataSources.am.name}`,
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
    await expectToHaveRedirectedToRoutesRoute();

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
    renderMuteTimings({ pathname: '/alerting/routes/new', search: `?alertmanager=${dataSources.am.name}` });

    await fillOutForm({ name: muteTimeInterval.name, days: '1' });

    await saveMuteTiming();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('replaces mute timings in routes when the mute timing name is changed', async () => {
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?muteName=${encodeURIComponent(muteTimeInterval.name)}&alertmanager=${dataSources.am.name}`,
    });

    expect(await ui.nameField.find()).toBeInTheDocument();
    expect(ui.nameField.get()).toHaveValue(muteTimeInterval.name);

    await userEvent.clear(ui.nameField.get());
    await fillOutForm({ name: 'Lunch breaks' });
    await saveMuteTiming();

    await expectToHaveRedirectedToRoutesRoute();
  });

  it('shows error when mute timing does not exist', async () => {
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${'does not exist'}`,
    });

    expect(await screen.findByText(/No matching time interval found/i)).toBeInTheDocument();
  });

  it('allows creation of new mute timings', async () => {
    renderMuteTimings('/alerting/routes/new');

    await fillOutForm({ name: 'a new time interval' });

    await saveMuteTiming();
    await expectToHaveRedirectedToRoutesRoute();
  });

  it('shows error when mute timing does not exist', async () => {
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${TIME_INTERVAL_NAME_HAPPY_PATH + '_force_breakage'}`,
    });

    expect(await screen.findByText(/No matching time interval found/i)).toBeInTheDocument();
  });

  it('loads edit form correctly and allows saving', async () => {
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?alertmanager=${GRAFANA_RULES_SOURCE_NAME}&muteName=${TIME_INTERVAL_NAME_HAPPY_PATH}`,
    });

    await saveMuteTiming();
    await expectToHaveRedirectedToRoutesRoute();
  });

  it('loads view form for provisioned interval', async () => {
    renderMuteTimings({
      pathname: '/alerting/routes/edit',
      search: `?muteName=${TIME_INTERVAL_NAME_FILE_PROVISIONED}`,
    });

    expect(await screen.findByText(/This time interval cannot be edited through the UI/i)).toBeInTheDocument();
  });
});
