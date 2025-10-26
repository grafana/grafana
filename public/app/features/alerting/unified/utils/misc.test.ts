import { FetchError } from '@grafana/runtime';
import {
  createExploreLink,
  makeDashboardLink,
  makeDataSourceLink,
  makeFolderAlertsLink,
  makeFolderLink,
  makeFolderSettingsLink,
  makeLabelBasedSilenceLink,
  makePanelLink,
  sortAlerts,
  stringifyErrorLike,
} from 'app/features/alerting/unified/utils/misc';
import { SortOrder } from 'app/plugins/panel/alertlist/types';
import { Alert } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

import { ApiMachineryError, ERROR_NEWER_CONFIGURATION, getErrorMessageFromCode } from './k8s/errors';

function withState(state: GrafanaAlertState, labels?: {}): Alert {
  return { activeAt: '', annotations: {}, labels: labels || {}, state: state, value: '' };
}

function withDate(activeAt?: string, labels?: {}): Alert {
  return {
    activeAt: activeAt || '',
    annotations: {},
    labels: labels || {},
    state: GrafanaAlertState.Alerting,
    value: '',
  };
}

function permute(inputArray: any[]): any[] {
  return inputArray.reduce(function permute(res, item, key, arr) {
    return res.concat(
      (arr.length > 1 &&
        arr
          .slice(0, key)
          .concat(arr.slice(key + 1))
          .reduce(permute, [])
          .map(function (perm: any) {
            return [item].concat(perm);
          })) ||
        item
    );
  }, []);
}

describe('Unified Altering misc', () => {
  describe('sortAlerts', () => {
    describe('when using any sortOrder with a list of alert instances', () => {
      it.each`
        alerts                                                                                                                   | sortOrder               | expected
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Normal)]}    | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Normal)]}
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.NoData)]}    | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Alerting), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.NoData)]}
        ${[withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Error), withState(GrafanaAlertState.Normal)]}       | ${SortOrder.Importance} | ${[withState(GrafanaAlertState.Error), withState(GrafanaAlertState.Pending), withState(GrafanaAlertState.Normal)]}
        ${[withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]} | ${SortOrder.TimeAsc}    | ${[withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00')]}
        ${[withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]} | ${SortOrder.TimeDesc}   | ${[withDate('2021-11-29T15:10:07-05:00'), withDate('2021-11-29T14:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00')]}
        ${[withDate('', { mno: 'pqr' }), withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' })]}                            | ${SortOrder.AlphaAsc}   | ${[withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' }), withDate('', { mno: 'pqr' })]}
        ${[withDate('', { mno: 'pqr' }), withDate('', { abc: 'def' }), withDate('', { ghi: 'jkl' })]}                            | ${SortOrder.AlphaDesc}  | ${[withDate('', { mno: 'pqr' }), withDate('', { ghi: 'jkl' }), withDate('', { abc: 'def' })]}
      `('then it should sort the alerts correctly', ({ alerts, sortOrder, expected }) => {
        const result = sortAlerts(sortOrder, alerts);

        expect(result).toEqual(expected);
      });
    });

    describe('when sorting ties', () => {
      it.each`
        alerts                                                                                                                                                   | sortOrder
        ${[withState(GrafanaAlertState.Alerting, { ghi: 'jkl' }), withState(GrafanaAlertState.Alerting, { abc: 'def' }), withState(GrafanaAlertState.Alerting)]} | ${SortOrder.Importance}
        ${[withDate('2021-11-29T13:10:07-05:00', { ghi: 'jkl' }), withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00', { abc: 'def' })]} | ${SortOrder.TimeAsc}
        ${[withDate('2021-11-29T13:10:07-05:00', { ghi: 'jkl' }), withDate('2021-11-29T13:10:07-05:00'), withDate('2021-11-29T13:10:07-05:00', { abc: 'def' })]} | ${SortOrder.TimeDesc}
      `('then tie order should be deterministic', ({ alerts, sortOrder }) => {
        // All input permutations should result in the same sorted order
        const sortedPermutations = permute(alerts).map((a) => sortAlerts(sortOrder, a));
        sortedPermutations.forEach((p) => {
          expect(p).toEqual(sortedPermutations[0]);
        });
      });
    });
  });
});

describe('createExploreLink', () => {
  it('should create a correct explore link', () => {
    const url = createExploreLink({ uid: 'uid', type: 'type' }, 'cpu_utilization > 0.5');
    expect(url).toBe(
      '/explore?left=%7B%22datasource%22%3A%22uid%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22datasource%22%3A%7B%22uid%22%3A%22uid%22%2C%22type%22%3A%22type%22%7D%2C%22expr%22%3A%22cpu_utilization+%3E+0.5%22%7D%5D%2C%22range%22%3A%7B%22from%22%3A%22now-1h%22%2C%22to%22%3A%22now%22%7D%7D'
    );
  });
});

describe('create links', () => {
  it('should create silence link', () => {
    expect(makeLabelBasedSilenceLink('grafana', { foo: 'bar', bar: 'baz' })).toBe(
      '/alerting/silence/new?alertmanager=grafana&matcher=foo%3Dbar&matcher=bar%3Dbaz'
    );
  });

  it('should create data source link', () => {
    expect(makeDataSourceLink('my-data-source')).toBe('/datasources/edit/my-data-source');
  });

  it('should make folder link', () => {
    expect(makeFolderLink('abc123')).toBe('/dashboards/f/abc123');
  });

  it('should make folder alerts link', () => {
    expect(makeFolderAlertsLink('abc123', 'my-title')).toBe('/dashboards/f/abc123/my-title/alerting');
  });

  it('should make folder settings link', () => {
    expect(makeFolderSettingsLink('abc123')).toBe('/dashboards/f/abc123/settings');
  });

  it('should make dashboard link', () => {
    expect(makeDashboardLink('abc123 def456')).toBe('/d/abc123%20def456');
  });
  it('should make panel link', () => {
    expect(makePanelLink('dashboard uid', '1')).toBe('/d/dashboard%20uid?viewPanel=1');
  });
});

describe('stringifyErrorLike', () => {
  it('should stringify error with cause', () => {
    const error = new Error('Something went wrong', { cause: new Error('database did not respond') });
    expect(stringifyErrorLike(error)).toBe('Something went wrong, cause: database did not respond');
  });

  it('should stringify error with cause being a code', () => {
    const error = new Error('Something went wrong', { cause: ERROR_NEWER_CONFIGURATION });
    expect(stringifyErrorLike(error)).toBe(getErrorMessageFromCode(ERROR_NEWER_CONFIGURATION));
  });

  it('should stringify Fetch error with message', () => {
    const error = { status: 404, data: {}, message: 'something broke' };
    expect(stringifyErrorLike(error)).toBe('something broke');
  });

  it('should stringify Fetch error with message embedded in HTTP response', () => {
    const error = { status: 404, data: { message: 'message from the API' } };
    expect(stringifyErrorLike(error)).toBe('request failed with 404: message from the API');
  });

  it('should stringify Fetch error with status text as fallback', () => {
    const error = { status: 404, data: {}, statusText: 'not found' };
    expect(stringifyErrorLike(error)).toBe('not found');
  });

  it('should stringify Fetch error with status number as fallback', () => {
    const error = { status: 404, data: {} };
    expect(stringifyErrorLike(error)).toBe('404');
  });

  it('should stringify ApiMachineryError with unknown code', () => {
    const error: ApiMachineryError = {
      apiVersion: 'v1',
      code: 409,
      details: { uid: 'some.code' },
      kind: 'Status',
      status: 'Failure',
      message: 'some message',
      reason: 'Conflict',
    };

    expect(stringifyErrorLike({ status: 409, data: error })).toBe('request failed with 409: some message');
  });

  it('should stringify ApiMachineryError with known code', () => {
    const error: ApiMachineryError = {
      apiVersion: 'v1',
      code: 409,
      details: { uid: ERROR_NEWER_CONFIGURATION },
      kind: 'Status',
      status: 'Failure',
      message: 'some message',
      reason: 'Conflict',
    };

    expect(stringifyErrorLike({ status: 409, data: error })).toBe(getErrorMessageFromCode(ERROR_NEWER_CONFIGURATION));
  });

  it('should stringify fetchh error with status code and URL', () => {
    const error = {
      status: 404,
      data: {
        message: 'not found',
      },
      config: {
        url: '/my/url',
        method: 'POST',
      },
    } satisfies FetchError;

    expect(stringifyErrorLike(error)).toBe('POST /my/url failed with 404: not found');
  });

  it('should prioritize data.message over statusText when both are present', () => {
    const error = {
      status: 500,
      data: { message: 'API error message' },
      statusText: 'Internal Server Error',
      config: { url: '/api/test', method: 'GET' },
    } satisfies FetchError;

    expect(stringifyErrorLike(error)).toBe('GET /api/test failed with 500: API error message');
  });

  it('should fall back to statusText when data.message is not available', () => {
    const error = {
      status: 404,
      data: { error: 'some other field' },
      statusText: 'Not Found',
      config: { url: '/api/test', method: 'GET' },
    } satisfies FetchError;

    expect(stringifyErrorLike(error)).toBe('Not Found');
  });

  it('should handle null data safely without crashing', () => {
    const error = {
      status: 500,
      data: null,
      statusText: 'Internal Server Error',
      config: { url: '/api/test', method: 'POST' },
    } satisfies FetchError<null>;

    expect(stringifyErrorLike(error)).toBe('Internal Server Error');
  });

  it('should handle undefined data safely without crashing', () => {
    const error = {
      status: 500,
      data: undefined,
      statusText: 'Internal Server Error',
      config: { url: '/api/test', method: 'PUT' },
    } satisfies FetchError<undefined>;

    expect(stringifyErrorLike(error)).toBe('Internal Server Error');
  });

  it('should handle data without message property safely', () => {
    const error = {
      status: 400,
      data: { error: 'validation failed', code: 400 },
      statusText: 'Bad Request',
      config: { url: '/api/validate', method: 'POST' },
    } satisfies FetchError;

    expect(stringifyErrorLike(error)).toBe('Bad Request');
  });

  it('should prioritize error.message over data.message', () => {
    const error = {
      status: 403,
      message: 'Error message property',
      data: { message: 'Data message property' },
      statusText: 'Forbidden',
      config: { url: '/api/test', method: 'POST' },
    } satisfies FetchError;

    expect(stringifyErrorLike(error)).toBe('Error message property');
  });
});
