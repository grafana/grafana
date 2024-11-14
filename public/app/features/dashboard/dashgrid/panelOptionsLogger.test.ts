import { GraphDrawStyle, GraphGradientMode } from '@grafana/schema';

const mockPushEvent = jest.fn();

import { PanelOptionsLogger } from './panelOptionsLogger';

jest.mock('@grafana/faro-web-sdk', () => ({
  faro: {
    api: {
      pushEvent: mockPushEvent,
    },
  },
}));

jest.mock('app/core/config', () => ({
  config: {
    grafanaJavascriptAgent: {
      enabled: true,
    },
  },
}));

describe('OptionsPane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('logs panel options', () => {
    const oldPanelOptions = {
      showHeader: true,
      footer: {
        show: true,
      },
    };

    const newPanelOptions = {
      showHeader: false,
      footer: {
        show: false,
      },
      showTypeIcons: true,
    };

    const panelInfo = {
      panelType: 'table',
      panelId: '1',
      panelTitle: 'Panel Title',
    };

    const expectedLogResults = [
      {
        key: 'showHeader',
        newValue: 'false',
        oldValue: 'true',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'table',
      },
      {
        key: 'footer',
        newValue: '{"show":false}',
        oldValue: '{"show":true}',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'table',
      },
      {
        key: 'showTypeIcons',
        newValue: 'true',
        oldValue: '',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'table',
      },
    ];

    const panelOptionsLogger = new PanelOptionsLogger(oldPanelOptions, { defaults: {}, overrides: [] }, panelInfo);

    panelOptionsLogger.logChanges(newPanelOptions, { defaults: {}, overrides: [] });

    expect(mockPushEvent).toHaveBeenCalledTimes(3);
    expect(mockPushEvent.mock.calls).toEqual([
      ['panel option changed', expectedLogResults[0]],
      ['panel option changed', expectedLogResults[1]],
      ['new panel option', expectedLogResults[2]],
    ]);
  });
  it('logs field config changes', () => {
    const oldFieldConfig = {
      defaults: {
        unit: 'bytes',
        custom: {
          drawStyle: GraphDrawStyle.Bars,
        },
      },
      overrides: [
        {
          matcher: {
            id: 'byName',
            options: '',
          },
          properties: [],
        },
      ],
    };

    const newFieldConfig = {
      defaults: {
        unit: 'metres',
        newField: 'newValue',
        custom: {
          drawStyle: GraphDrawStyle.Line,
          gradientMode: GraphGradientMode.Hue,
        },
      },
      overrides: [],
    };

    const panelInfo = {
      panelType: 'timeseries',
      panelId: '1',
      panelTitle: 'Panel Title',
    };

    const expectedLogResults = [
      {
        key: 'overrides',
        newValue: '[]',
        oldValue: '[{"matcher":{"id":"byName","options":""},"properties":[]}]',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'timeseries',
      },
      {
        key: 'unit',
        newValue: 'metres',
        oldValue: 'bytes',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'timeseries',
      },
      {
        key: 'newField',
        newValue: 'newValue',
        oldValue: '',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'timeseries',
      },
      {
        key: 'drawStyle',
        newValue: 'line',
        oldValue: 'bars',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'timeseries',
      },
      {
        key: 'gradientMode',
        newValue: 'hue',
        oldValue: '',
        panelTitle: 'Panel Title',
        panelId: '1',
        panelType: 'timeseries',
      },
    ];

    const panelOptionsLogger = new PanelOptionsLogger({}, oldFieldConfig, panelInfo);

    panelOptionsLogger.logChanges({}, newFieldConfig);

    expect(mockPushEvent).toHaveBeenCalledTimes(5);
    expect(mockPushEvent.mock.calls).toEqual([
      ['field config overrides changed', expectedLogResults[0]],
      ['default field config changed', expectedLogResults[1]],
      ['new default field config', expectedLogResults[2]],
      ['custom field config changed', expectedLogResults[3]],
      ['new custom field config', expectedLogResults[4]],
    ]);
  });
});
