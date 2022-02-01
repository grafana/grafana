import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { fetchSilences, fetchAlerts, createOrUpdateSilence } from './api/alertmanager';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { configureStore } from 'app/store/configureStore';
import Silences from './Silences';
import { mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv, mockSilence } from './mocks';
import { DataSourceType } from './utils/datasource';
import { parseMatchers } from './utils/alertmanager';
import { AlertState, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';
import userEvent from '@testing-library/user-event';

jest.mock('./api/alertmanager');

const TEST_TIMEOUT = 60000;

const mocks = {
  api: {
    fetchSilences: typeAsJestMock(fetchSilences),
    fetchAlerts: typeAsJestMock(fetchAlerts),
    createOrUpdateSilence: typeAsJestMock(createOrUpdateSilence),
  },
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
  queryBar: byPlaceholderText('Search'),
  editor: {
    timeRange: byLabelText('Timepicker', { exact: false }),
    durationField: byLabelText('Duration'),
    durationInput: byRole('textbox', { name: /duration/i }),
    matchersField: byTestId('matcher'),
    matcherName: byPlaceholderText('label'),
    matcherValue: byPlaceholderText('value'),
    comment: byPlaceholderText('Details about the silence'),
    createdBy: byPlaceholderText('User'),
    matcherOperatorSelect: byLabelText('operator'),
    matcherOperator: (operator: MatcherOperator) => byText(operator, { exact: true }),
    addMatcherButton: byRole('button', { name: 'Add matcher' }),
    submit: byText('Submit'),
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
      userEvent.paste(queryBar, 'foo=bar');

      await waitFor(() => expect(ui.silenceRow.getAll()).toHaveLength(1));
    },
    TEST_TIMEOUT
  );
});

describe('Silence edit', () => {
  const baseUrlPath = '/alerting/silence/new';
  beforeAll(resetMocks);
  afterEach(resetMocks);

  beforeEach(() => {
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
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

      const startDateString = dateTime(start).format('YYYY-MM-DD');
      const endDateString = dateTime(end).format('YYYY-MM-DD');

      userEvent.clear(ui.editor.durationInput.get());
      userEvent.type(ui.editor.durationInput.get(), '1d');

      await waitFor(() => expect(ui.editor.durationInput.query()).toHaveValue('1d'));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(startDateString));
      await waitFor(() => expect(ui.editor.timeRange.get()).toHaveTextContent(endDateString));

      userEvent.type(ui.editor.matcherName.get(), 'foo');
      userEvent.type(ui.editor.matcherOperatorSelect.get(), '=');
      userEvent.tab();
      userEvent.type(ui.editor.matcherValue.get(), 'bar');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
      userEvent.type(ui.editor.matcherName.getAll()[1], 'bar');
      userEvent.type(ui.editor.matcherOperatorSelect.getAll()[1], '!=');
      userEvent.tab();
      userEvent.type(ui.editor.matcherValue.getAll()[1], 'buzz');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
      userEvent.type(ui.editor.matcherName.getAll()[2], 'region');
      userEvent.type(ui.editor.matcherOperatorSelect.getAll()[2], '=~');
      userEvent.tab();
      userEvent.type(ui.editor.matcherValue.getAll()[2], 'us-west-.*');

      // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
      userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
      userEvent.type(ui.editor.matcherName.getAll()[3], 'env');
      userEvent.type(ui.editor.matcherOperatorSelect.getAll()[3], '!~');
      userEvent.tab();
      userEvent.type(ui.editor.matcherValue.getAll()[3], 'dev|staging');

      userEvent.type(ui.editor.comment.get(), 'Test');
      userEvent.type(ui.editor.createdBy.get(), 'Homer Simpson');

      userEvent.click(ui.editor.submit.get());

      await waitFor(() =>
        expect(mocks.api.createOrUpdateSilence).toHaveBeenCalledWith(
          'grafana',
          expect.objectContaining({
            comment: 'Test',
            createdBy: 'Homer Simpson',
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
