import { Action, ActionType, ActionVariableInput, ActionVariableType } from '@grafana/data';

import { HttpRequestMethod } from '../../plugins/panel/canvas/panelcfg.gen';

import { buildActionRequest, genReplaceActionVars } from './utils';

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
