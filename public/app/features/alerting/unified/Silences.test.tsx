import { render, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';

import { dateTime } from '@grafana/data';
import { locationService, setDataSourceSrv, config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertState, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';

import Silences from './Silences';
import { fetchSilences, fetchAlerts, createOrUpdateSilence } from './api/alertmanager';
import { mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv, mockSilence } from './mocks';
import { parseMatchers } from './utils/alertmanager';
import { DataSourceType } from './utils/datasource';

jest.mock('./api/alertmanager');
jest.mock('app/core/services/context_srv');

const TEST_TIMEOUT = 60000;

const mocks = {
  api: {
    fetchSilences: jest.mocked(fetchSilences),
    fetchAlerts: jest.mocked(fetchAlerts),
    createOrUpdateSilence: jest.mocked(createOrUpdateSilence),
  },
  contextSrv: jest.mocked(contextSrv),
};

const renderSilences = (location = '/alerting/silences/') => {
  const store = configureStore();
  locationService.push(location);

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Silences />
      </Router>
    </Provider>
  );
};

const dataSources = {
  am: mockDataSource({
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  silencesTable: byTestId('dynamic-table'),
  silenceRow: byTestId('row'),
  silencedAlertCell: byTestId('alerts'),
  addSilenceButton: byRole('button', { name: /new silence/i }),
  queryBar: byPlaceholderText('Search'),
  editor: {
    timeRange: byLabelText('Timepicker', { exact: false }),
    durationField: byLabelText('Duration'),
    durationInput: byRole('textbox', { name: /duration/i }),
    matchersField: byTestId('matcher'),
    matcherName: byPlaceholderText('label'),
    matcherValue: byPlaceholderText('value'),
    comment: byPlaceholderText('Details about the silence'),
    matcherOperatorSelect: byLabelText('operator'),
    matcherOperator: (operator: MatcherOperator) => byText(operator, { exact: true }),
    addMatcherButton: byRole('button', { name: 'Add matcher' }),
    submit: byText('Submit'),
    createdBy: byText(/created by \*/i),
  },
};

const resetMocks = () => {
  jest.resetAllMocks();
  mocks.api.fetchSilences.mockImplementation(() => {
    return Promise.resolve([
      mockSilence({ id: '12345' }),
      mockSilence({ id: '67890', matchers: parseMatchers('foo!=bar'), comment: 'Catch all' }),
    ]);
  });

  mocks.api.fetchAlerts.mockImplementation(() => {
    return Promise.resolve([
      mockAlertmanagerAlert({
        labels: { foo: 'bar' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'buzz' },
        status: { state: AlertState.Suppressed, silencedBy: ['67890'], inhibitedBy: [] },
      }),
    ]);
  });

  mocks.api.createOrUpdateSilence.mockResolvedValue(mockSilence());

  mocks.contextSrv.evaluatePermission.mockImplementation(() => []);
  mocks.contextSrv.hasPermission.mockImplementation((action) => {
    const permissions = [
      AccessControlAction.AlertingInstanceRead,
      AccessControlAction.AlertingInstanceCreate,
      AccessControlAction.AlertingInstanceUpdate,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingInstancesExternalWrite,
    ];
    return permissions.includes(action as AccessControlAction);
  });

  mocks.contextSrv.hasAccess.mockImplementation(() => true);
};

const setUserLogged = (isLogged: boolean) => {
  config.bootData.user.isSignedIn = isLogged;
  config.bootData.user.name = isLogged ? 'admin' : '';
};

describe('Silences', () => {
  beforeAll(resetMocks);
  afterEach(resetMocks);

  beforeEach(() => {
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
  });

  it(
    'loads and shows silences',
    async () => {
      renderSilences();
      await waitFor(() => expect(mocks.api.fetchSilences).toHaveBeenCalled());
      await waitFor(() => expect(mocks.api.fetchAlerts).toHaveBeenCalled());

      expect(ui.silencesTable.query()).not.toBeNull();

      const silences = ui.silenceRow.queryAll();
      expect(silences).toHaveLength(2);
      expect(silences[0]).toHaveTextContent('foo=bar');
      expect(silences[1]).toHaveTextContent('foo!=bar');
    },
    TEST_TIMEOUT
  );

  it(
    'shows the correct number of silenced alerts',
    async () => {
      mocks.api.fetchAlerts.mockImplementation(() => {
        return Promise.resolve([
          mockAlertmanagerAlert({
            labels: { foo: 'bar', buzz: 'bazz' },
            status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
          }),
          mockAlertmanagerAlert({
            labels: { foo: 'bar', buzz: 'bazz' },
            status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
          }),
        ]);
      });

      renderSilences();
      await waitFor(() => expect(mocks.api.fetchSilences).toHaveBeenCalled());
      await waitFor(() => expect(mocks.api.fetchAlerts).toHaveBeenCalled());

      const silencedAlertRows = ui.silencedAlertCell.getAll(ui.silencesTable.get());
      expect(silencedAlertRows).toHaveLength(2);
      expect(silencedAlertRows[0]).toHaveTextContent('2');
      expect(silencedAlertRows[1]).toHaveTextContent('0');
    },
    TEST_TIMEOUT
  );

  it(
    'filters silences by matchers',
    async () => {
      renderSilences();
      await waitFor(() => expect(mocks.api.fetchSilences).toHaveBeenCalled());
      await waitFor(() => expect(mocks.api.fetchAlerts).toHaveBeenCalled());

      const queryBar = ui.queryBar.get();
      await userEvent.click(queryBar);
      await userEvent.paste('foo=bar');

      await waitFor(() => expect(ui.silenceRow.getAll()).toHaveLength(1));
    },
    TEST_TIMEOUT
  );

  it('shows creating a silence button for users with access', async () => {
    renderSilences();

    await waitFor(() => expect(mocks.api.fetchSilences).toHaveBeenCalled());
    await waitFor(() => expect(mocks.api.fetchAlerts).toHaveBeenCalled());

    expect(ui.addSilenceButton.get()).toBeInTheDocument();
  });

  it('hides actions for creating a silence for users without access', async () => {
    mocks.contextSrv.hasAccess.mockImplementation((action) => {
      const permissions = [AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingInstancesExternalRead];
      return permissions.includes(action as AccessControlAction);
    });

    renderSilences();
    await waitFor(() => expect(mocks.api.fetchSilences).toHaveBeenCalled());
    await waitFor(() => expect(mocks.api.fetchAlerts).toHaveBeenCalled());

    expect(ui.addSilenceButton.query()).not.toBeInTheDocument();
  });
});

describe('Silence edit', () => {
  const baseUrlPath = '/alerting/silence/new';
  beforeAll(resetMocks);
  afterEach(resetMocks);

  beforeEach(() => {
    setUserLogged(true);
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
  });

  it('Should not render createdBy if user is logged in and has a name', async () => {
    renderSilences(baseUrlPath);
    await waitFor(() => expect(ui.editor.createdBy.query()).not.toBeInTheDocument());
  });
  it('Should render createdBy if user is not logged or has no name', async () => {
    setUserLogged(false);
    renderSilences(baseUrlPath);
    await waitFor(() => expect(ui.editor.createdBy.get()).toBeInTheDocument());
  });
  it(
    'prefills the matchers field with matchers params',
    async () => {
      const matchersParams = ['foo=bar', 'bar=~ba.+', 'hello!=world', 'cluster!~us-central.*'];
      const matchersQueryString = matchersParams.map((matcher) => `matcher=${encodeURIComponent(matcher)}`).join('&');

      renderSilences(`${baseUrlPath}?${matchersQueryString}`);
      await waitFor(() => expect(ui.editor.durationField.query()).not.toBeNull());

      const matchers = ui.editor.matchersField.queryAll();
      expect(matchers).toHaveLength(4);

      expect(ui.editor.matcherName.query(matchers[0])).toHaveValue('foo');
      expect(ui.editor.matcherOperator(MatcherOperator.equal).query(matchers[0])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[0])).toHaveValue('bar');

      expect(ui.editor.matcherName.query(matchers[1])).toHaveValue('bar');
      expect(ui.editor.matcherOperator(MatcherOperator.regex).query(matchers[1])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[1])).toHaveValue('ba.+');

      expect(ui.editor.matcherName.query(matchers[2])).toHaveValue('hello');
      expect(ui.editor.matcherOperator(MatcherOperator.notEqual).query(matchers[2])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[2])).toHaveValue('world');

      expect(ui.editor.matcherName.query(matchers[3])).toHaveValue('cluster');
      expect(ui.editor.matcherOperator(MatcherOperator.notRegex).query(matchers[3])).not.toBeNull();
      expect(ui.editor.matcherValue.query(matchers[3])).toHaveValue('us-central.*');
    },
    TEST_TIMEOUT
  );

  it(
    'creates a new silence',
    async () => {
      renderSilences(baseUrlPath);
      await waitFor(() => expect(ui.editor.durationField.query()).not.toBeNull());

      const start = new Date();
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const now = dateTime().format('YYYY-MM-DD HH:mm');

      const startDateString = dateTime(start).format('YYYY-MM-DD');
      const endDateString = dateTime(end).format('YYYY-MM-DD');

      await userEvent.clear(ui.editor.durationInput.get());
      await userEvent.type(ui.editor.durationInput.get(), '1d');

      await waitFor(() => expect(ui.editor.durationInput.query()).toHaveValue('1d'));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(startDateString));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(endDateString));

      await userEvent.type(ui.editor.matcherName.get(), 'foo');
      await userEvent.type(ui.editor.matcherOperatorSelect.get(), '=');
      await userEvent.tab();
      await userEvent.type(ui.editor.matcherValue.get(), 'bar');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      await userEvent.click(ui.editor.addMatcherButton.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });
      await userEvent.type(ui.editor.matcherName.getAll()[1], 'bar');
      await userEvent.type(ui.editor.matcherOperatorSelect.getAll()[1], '!=');
      await userEvent.tab();
      await userEvent.type(ui.editor.matcherValue.getAll()[1], 'buzz');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      await userEvent.click(ui.editor.addMatcherButton.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });
      await userEvent.type(ui.editor.matcherName.getAll()[2], 'region');
      await userEvent.type(ui.editor.matcherOperatorSelect.getAll()[2], '=~');
      await userEvent.tab();
      await userEvent.type(ui.editor.matcherValue.getAll()[2], 'us-west-.*');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      await userEvent.click(ui.editor.addMatcherButton.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });
      await userEvent.type(ui.editor.matcherName.getAll()[3], 'env');
      await userEvent.type(ui.editor.matcherOperatorSelect.getAll()[3], '!~');
      await userEvent.tab();
      await userEvent.type(ui.editor.matcherValue.getAll()[3], 'dev|staging');

      await userEvent.click(ui.editor.submit.get());

      await waitFor(() =>
        expect(mocks.api.createOrUpdateSilence).toHaveBeenCalledWith(
          'grafana',
          expect.objectContaining({
            comment: `created ${now}`,
            matchers: [
              { isEqual: true, isRegex: false, name: 'foo', value: 'bar' },
              { isEqual: false, isRegex: false, name: 'bar', value: 'buzz' },
              { isEqual: true, isRegex: true, name: 'region', value: 'us-west-.*' },
              { isEqual: false, isRegex: true, name: 'env', value: 'dev|staging' },
            ],
          })
        )
      );
    },
    TEST_TIMEOUT
  );
});
