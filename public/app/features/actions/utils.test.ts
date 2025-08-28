import { Action, ActionType, ActionVariableInput, ActionVariableType, HttpRequestMethod } from '@grafana/data';

import { buildActionRequest, buildActionProxyRequest, genReplaceActionVars, INFINITY_DATASOURCE_TYPE } from './utils';

jest.mock('../query/state/PanelQueryRunner', () => ({
  getNextRequestId: jest.fn(() => 'test-request-id-123'),
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

describe('Infinity connections', () => {
  const mockReplaceVariables = jest.fn((str) => str);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildActionProxyRequest', () => {
    const createProxyConnectionAction = (overrides = {}): Action => ({
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
      const action = createProxyConnectionAction();

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
      const action = createProxyConnectionAction({
        method: HttpRequestMethod.GET,
        body: '',
      });

      const request = buildActionProxyRequest(action, mockReplaceVariables);

      expect(request.data.queries[0].url_options.method).toBe(HttpRequestMethod.GET);
      expect(request.data.queries[0].url_options.data).toBeUndefined();
    });

    it('should throw error for missing datasource UID', () => {
      const action = createProxyConnectionAction({
        datasourceUid: '',
      });

      expect(() => {
        buildActionProxyRequest(action, mockReplaceVariables);
      }).toThrow('Datasource not configured for Infinity action');
    });
  });
});
