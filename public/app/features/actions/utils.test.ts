import { of, throwError } from 'rxjs';

import {
  type Action,
  ActionType,
  type ActionVariableInput,
  ActionVariableType,
  AppEvents,
  HttpRequestMethod,
  type DataFrame,
  type DataLink,
  type Field,
  FieldType,
} from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';

import * as analytics from './analytics';
import {
  buildActionRequest,
  buildActionProxyRequest,
  genReplaceActionVars,
  getActionsDefaultField,
  isInfinityActionWithAuth,
  getActions,
  INFINITY_DATASOURCE_TYPE,
} from './utils';

jest.mock('../query/state/PanelQueryRunner', () => ({
  getNextRequestId: jest.fn(() => 'test-request-id-123'),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('interpolateActionVariables', () => {
  const actionMock = (): Action => ({
    title: 'Thermostat Control',
    type: ActionType.Fetch,
    variables: [
      { key: 'thermostat1', name: 'First Floor Thermostat', type: ActionVariableType.String },
      { key: 'thermostat2', name: 'Second Floor Thermostat', type: ActionVariableType.String },
    ],
    fetch: {
      url: 'http://test.com/api/thermostats/$thermostat1/sync/$thermostat2',
      method: HttpRequestMethod.POST,
      body: JSON.stringify({
        primary: 'Device-$thermostat1',
        data: {
          secondary: 'Room-$thermostat2',
          settings: {
            syncMode: 'Mode-$thermostat1',
          },
        },
      }),
      headers: [
        ['Device-ID', 'Thermostat-$thermostat1'],
        ['Content-Type', 'application/json'],
      ],
      queryParams: [
        ['primary', 'Device-$thermostat1'],
        ['secondary', 'Room-$thermostat2'],
        ['mode', 'sync'],
      ],
    },
  });

  it('should return original action if no variables or actionVars are provided', () => {
    const action: Action = {
      title: 'Test',
      type: ActionType.Fetch,
      [ActionType.Fetch]: {
        url: 'http://test.com/api/',
        method: HttpRequestMethod.GET,
      },
    };
    const actionVars: ActionVariableInput = {};

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(request).toEqual({
      headers: {
        'X-Grafana-Action': '1',
      },
      method: 'GET',
      url: 'http://test.com/api/',
    });
  });

  it('should interpolate variables in URL', () => {
    const action = actionMock();
    const actionVars: ActionVariableInput = {
      thermostat1: 'T-001',
      thermostat2: 'T-002',
    };

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(request.url).toBe(
      'http://test.com/api/thermostats/T-001/sync/T-002?primary=Device-T-001&secondary=Room-T-002&mode=sync'
    );
  });

  it('should interpolate variables in request body', () => {
    const action = actionMock();
    const actionVars: ActionVariableInput = {
      thermostat1: 'T-001',
      thermostat2: 'T-002',
    };

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(JSON.parse(request.data)).toEqual({
      primary: 'Device-T-001',
      data: {
        secondary: 'Room-T-002',
        settings: {
          syncMode: 'Mode-T-001',
        },
      },
    });
  });

  it('should interpolate variables in headers', () => {
    const action = actionMock();
    const actionVars: ActionVariableInput = {
      thermostat1: 'T-001',
      thermostat2: 'T-002',
    };

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(request.headers).toEqual({
      'Content-Type': 'application/json',
      'Device-ID': 'Thermostat-T-001',
      'X-Grafana-Action': '1',
    });
  });

  it('should interpolate variables in query params', () => {
    const action = actionMock();
    const actionVars: ActionVariableInput = {
      thermostat1: 'T-001',
      thermostat2: 'T-002',
    };

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(request.url).toEqual(
      'http://test.com/api/thermostats/T-001/sync/T-002?primary=Device-T-001&secondary=Room-T-002&mode=sync'
    );
  });

  it('should only interpolate provided variables', () => {
    const action = actionMock();
    const actionVars: ActionVariableInput = {
      thermostat1: 'T-001',
      // thermostat2 is not provided
    };

    const request = buildActionRequest(
      action,
      genReplaceActionVars((str) => str, action, actionVars)
    );
    expect(request.url).toBe(
      'http://test.com/api/thermostats/T-001/sync/$thermostat2?primary=Device-T-001&secondary=Room-%24thermostat2&mode=sync'
    );
    expect(JSON.parse(request.data).data.secondary).toBe('Room-$thermostat2');
  });
});

describe('Infinity request', () => {
  const mockReplaceVariables = jest.fn((str) => str);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildActionProxyRequest', () => {
    const infinityActionMock = (overrides = {}): Action => ({
      title: 'Infinity API Call',
      type: ActionType.Infinity,
      [ActionType.Infinity]: {
        method: HttpRequestMethod.POST,
        url: 'https://api.example.com/data',
        body: '{"test": "data"}',
        headers: [
          ['Content-Type', 'application/json'],
          ['Authorization', 'Bearer token123'],
        ],
        queryParams: [
          ['filter', 'active'],
          ['limit', '10'],
        ],
        datasourceUid: 'infinity-ds-uid',
        ...overrides,
      },
    });

    it('should build Infinity proxy request with all parameters', () => {
      const action = infinityActionMock();

      const request = buildActionProxyRequest(action, mockReplaceVariables);

      expect(request).toEqual({
        url: `api/ds/query?ds_type=${INFINITY_DATASOURCE_TYPE}&requestId=test-request-id-123`,
        method: HttpRequestMethod.POST,
        data: {
          queries: [
            {
              refId: 'A',
              datasource: {
                type: INFINITY_DATASOURCE_TYPE,
                uid: 'infinity-ds-uid',
              },
              type: 'json',
              source: 'url',
              format: 'as-is',
              url: new URL('https://api.example.com/data'),
              url_options: {
                method: HttpRequestMethod.POST,
                data: '{"test": "data"}',
                headers: [
                  { key: 'Content-Type', value: 'application/json' },
                  { key: 'Authorization', value: 'Bearer token123' },
                ],
                params: [
                  { key: 'filter', value: 'active' },
                  { key: 'limit', value: '10' },
                ],
                body_type: 'raw',
                body_content_type: 'application/json',
              },
            },
          ],
          from: expect.any(String),
          to: expect.any(String),
        },
      });
    });

    it('should handle GET requests without body', () => {
      const action = infinityActionMock({
        method: HttpRequestMethod.GET,
        body: '',
      });

      const request = buildActionProxyRequest(action, mockReplaceVariables);

      expect(request.data.queries[0].url_options.method).toBe(HttpRequestMethod.GET);
      expect(request.data.queries[0].url_options.data).toBeUndefined();
    });

    it('should throw error for missing datasource UID', () => {
      const action = infinityActionMock({
        datasourceUid: '',
      });

      expect(() => {
        buildActionProxyRequest(action, mockReplaceVariables);
      }).toThrow('Datasource not configured for Infinity action');
    });
  });
});

describe('isInfinityActionWithAuth', () => {
  const originalFeatureToggles = config.featureToggles;
  const infinityAction: Action = { title: 'Infinity action', type: ActionType.Infinity };
  const fetchAction: Action = { title: 'Fetch action', type: ActionType.Fetch };

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])('returns %s when toggle is %s', (toggle, expected) => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: toggle };
    expect(isInfinityActionWithAuth(infinityAction)).toBe(expected);
  });

  it('returns false for Fetch action', () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
    expect(isInfinityActionWithAuth(fetchAction)).toBe(false);
  });
});

describe('getActions filtering', () => {
  const originalFeatureToggles = config.featureToggles;
  const mockFrame: DataFrame = { name: 'test', fields: [], length: 0 };
  const mockField: Field = { name: 'test-field', type: FieldType.string, values: [], config: {} };
  const mockReplaceVariables = jest.fn((str) => str);

  const fetchAction: Action = {
    title: 'Fetch action',
    type: ActionType.Fetch,
    [ActionType.Fetch]: { url: '', method: HttpRequestMethod.GET },
  };
  const infinityAction: Action = {
    title: 'Infinity action',
    type: ActionType.Infinity,
    [ActionType.Infinity]: { url: '', method: HttpRequestMethod.GET, datasourceUid: 'uid' },
  };

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
    jest.clearAllMocks();
  });

  it.each([
    [true, [infinityAction, fetchAction], 2, ['Infinity action', 'Fetch action']],
    [false, [infinityAction, fetchAction], 1, ['Fetch action']],
    [false, [infinityAction], 0, []],
    [false, [fetchAction], 1, ['Fetch action']],
  ])('filters correctly when toggle=%s', (toggle, actions, expectedCount, expectedActionTitles) => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: toggle };

    const result = getActions(mockFrame, mockField, {}, mockReplaceVariables, actions, {});

    expect(result).toHaveLength(expectedCount);
    expect(result.map((a) => a.title)).toEqual(expectedActionTitles);
  });

  it('returns an empty array when no actions are provided', () => {
    expect(getActions(mockFrame, mockField, {}, mockReplaceVariables, [], {})).toEqual([]);
  });

  it('builds an action model with interpolated title and default confirmation', () => {
    const replaceVariables = jest.fn((str: string) => str.replace('${name}', 'Pump 1'));

    const result = getActions(
      mockFrame,
      mockField,
      {},
      replaceVariables,
      [{ ...fetchAction, title: 'Restart ${name}' }],
      {}
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Restart Pump 1');
    // The default confirmation runs through the bound replace function.
    expect(result[0].confirmation()).toBe('Are you sure you want to Restart Pump 1?');
    expect(result[0].oneClick).toBe(false);
    expect(result[0].style).toEqual({ backgroundColor: expect.any(String) });
  });

  it('uses the action confirmation override and interpolates action variables in it', () => {
    const actionWithVars: Action = {
      title: 'Restart',
      type: ActionType.Fetch,
      confirmation: 'Restart $device now?',
      variables: [{ key: 'device', name: 'Device', type: ActionVariableType.String }],
      [ActionType.Fetch]: { url: '', method: HttpRequestMethod.GET },
    };

    const result = getActions(mockFrame, mockField, {}, (str) => str, [actionWithVars], {});

    expect(result[0].confirmation({ device: 'Pump 1' })).toBe('Restart Pump 1 now?');
  });
});

describe('getActionsDefaultField', () => {
  it('returns a Default field with the provided links and actions', () => {
    const links: DataLink[] = [{ title: 'My link', url: '/foo' }];
    const actions: Action[] = [{ title: 'My action', type: ActionType.Fetch }];

    const field = getActionsDefaultField(links, actions);

    expect(field).toEqual({
      name: 'Default field',
      type: FieldType.string,
      config: { links, actions },
      values: [],
    });
  });

  it('defaults to empty links and actions arrays when nothing is provided', () => {
    const field = getActionsDefaultField();

    expect(field.config.links).toEqual([]);
    expect(field.config.actions).toEqual([]);
  });
});

describe('genReplaceActionVars', () => {
  it('returns the value unchanged when the action has no variables', () => {
    const action: Action = { title: 'No vars', type: ActionType.Fetch };
    const fn = genReplaceActionVars((s) => s, action, { foo: 'bar' });

    expect(fn('hello $foo', {}, undefined)).toBe('hello $foo');
  });

  it('returns the value unchanged when actionVars is not provided', () => {
    const action: Action = {
      title: 'With vars but no input',
      type: ActionType.Fetch,
      variables: [{ key: 'foo', name: 'Foo', type: ActionVariableType.String }],
    };
    const fn = genReplaceActionVars((s) => s, action);

    expect(fn('hello $foo', {}, undefined)).toBe('hello $foo');
  });

  it('leaves variables not defined on the action untouched', () => {
    const action: Action = {
      title: 'Known vars only',
      type: ActionType.Fetch,
      variables: [{ key: 'known', name: 'Known', type: ActionVariableType.String }],
    };
    const fn = genReplaceActionVars((s) => s, action, { known: 'yes', other: 'no' });

    expect(fn('$known then $other', {}, undefined)).toBe('yes then $other');
  });

  it('forwards to the bound replace function for non-action variables', () => {
    const action: Action = { title: 'Pass-through', type: ActionType.Fetch };
    const bound = jest.fn((value: string) => value.toUpperCase());
    const fn = genReplaceActionVars(bound, action, { foo: 'bar' });

    expect(fn('plain', {}, undefined)).toBe('PLAIN');
    expect(bound).toHaveBeenCalled();
  });
});

describe('getActions onClick', () => {
  const mockFrame: DataFrame = { name: 'test', fields: [], length: 0 };
  const mockField: Field = { name: 'test-field', type: FieldType.string, values: [], config: {} };
  const baseAction: Action = {
    title: 'Trigger',
    type: ActionType.Fetch,
    [ActionType.Fetch]: { url: 'https://api.example.com/run', method: HttpRequestMethod.GET },
  };

  let fetchMock: jest.Mock;
  let appEventsEmitSpy: jest.SpyInstance;
  let reportActionTriggerSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn().mockReturnValue(of({}));
    jest.mocked(getBackendSrv).mockReturnValue({ fetch: fetchMock } as unknown as ReturnType<typeof getBackendSrv>);
    appEventsEmitSpy = jest.spyOn(appEvents, 'emit').mockImplementation();
    reportActionTriggerSpy = jest.spyOn(analytics, 'reportActionTrigger').mockImplementation();
  });

  afterEach(() => {
    jest.mocked(getBackendSrv).mockReset();
    appEventsEmitSpy.mockRestore();
    reportActionTriggerSpy.mockRestore();
  });

  it('reports the action trigger when a visualization type is provided', () => {
    const [model] = getActions(mockFrame, mockField, {}, (s) => s, [baseAction], {}, 'stat');

    model.onClick(new MouseEvent('click'), mockField);

    expect(reportActionTriggerSpy).toHaveBeenCalledWith('fetch', false, 'stat');
  });

  it('does not report the action trigger when visualization type is omitted', () => {
    const [model] = getActions(mockFrame, mockField, {}, (s) => s, [baseAction], {});

    model.onClick(new MouseEvent('click'), mockField);

    expect(reportActionTriggerSpy).not.toHaveBeenCalled();
  });

  it('emits a success event when the request completes', () => {
    const [model] = getActions(mockFrame, mockField, {}, (s) => s, [baseAction], {});

    model.onClick(new MouseEvent('click'), mockField);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appEventsEmitSpy).toHaveBeenCalledWith(AppEvents.alertSuccess, ['API call was successful']);
  });

  it('emits an error event when the request errors out', () => {
    fetchMock.mockReturnValue(throwError(() => new Error('boom')));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const [model] = getActions(mockFrame, mockField, {}, (s) => s, [baseAction], {});

    model.onClick(new MouseEvent('click'), mockField);

    expect(appEventsEmitSpy).toHaveBeenCalledWith(AppEvents.alertError, [
      'An error has occurred. Check console output for more details.',
    ]);
    consoleErrorSpy.mockRestore();
  });

  it('emits an error event when fetch throws synchronously', () => {
    fetchMock.mockImplementation(() => {
      throw new Error('cannot build request');
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const [model] = getActions(mockFrame, mockField, {}, (s) => s, [baseAction], {});

    model.onClick(new MouseEvent('click'), mockField);

    expect(appEventsEmitSpy).toHaveBeenCalledWith(AppEvents.alertError, [
      'An error has occurred. Check console output for more details.',
    ]);
    consoleErrorSpy.mockRestore();
  });
});
