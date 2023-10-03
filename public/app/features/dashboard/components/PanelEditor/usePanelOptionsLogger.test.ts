import { renderHook } from '@testing-library/react';

import { GraphDrawStyle, GraphGradientMode } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { DashboardSavedEvent } from 'app/types/events';

const mockPushEvent = jest.fn();

import { usePanelOptionsLogger } from './usePanelOptionsLogger';

jest.mock('app/core/config', () => ({
  config: {
    grafanaJavascriptAgent: {
      enabled: true,
    },
    featureToggles: {
      panelMonitoring: true,
    },
  },
}));

jest.mock('@grafana/faro-web-sdk', () => ({
  faro: {
    api: {
      pushEvent: mockPushEvent,
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

    const props = {
      panelType: 'table',
      panelId: 1,
      panelTitle: 'Panel Title',
      panelOptions: oldPanelOptions,
      panelFieldConfig: {
        defaults: {},
        overrides: [],
      },
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

    const hook = renderHook(() => usePanelOptionsLogger(props));

    props.panelOptions = newPanelOptions;

    hook.rerender(props);

    appEvents.publish(new DashboardSavedEvent());

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

    const props = {
      isInPanelEdit: true,
      panelType: 'timeseries',
      panelId: 1,
      panelTitle: 'Panel Title',
      panelOptions: {},
      panelFieldConfig: oldFieldConfig,
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

    const hook = renderHook(() => usePanelOptionsLogger(props));

    props.panelFieldConfig = newFieldConfig;

    hook.rerender(props);

    appEvents.publish(new DashboardSavedEvent());

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
