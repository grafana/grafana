import { renderHook } from '@testing-library/react';

import { DataSourceRef } from '@grafana/schema';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../utils/utils';

import { useSoloPanel } from './useSoloPanel';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async (ref: DataSourceRef) => {
      // Mocking the build in Grafana data source to avoid annotations data layer errors.
      return {
        id: 1,
        uid: '-- Grafana --',
        name: 'grafana',
        type: 'grafana',
        meta: {
          id: 'grafana',
        },
      };
    },
  }),
}));

describe('useSoloPanel', () => {
  it('should return undefined panel and error when panel is not found', () => {
    const { dashboard } = setup();
    const { result } = renderHook(() => useSoloPanel(dashboard, 'foo-key'));

    expect(result.current[0]).toBeUndefined();
    expect(result.current[1]).toBe('Panel not found');
  });

  it('should return the panel when panel is found', () => {
    const { dashboard } = setup();

    const { result } = renderHook(() => useSoloPanel(dashboard, 'panel-1'));
    const panel = findVizPanelByKey(dashboard, 'panel-1');

    expect(result.current[0]).toEqual(panel);
    expect(result.current[1]).toBeUndefined();
  });

  it('should return the cloned panel when panel is found', () => {
    const { dashboard } = setup();
    const { result } = renderHook(() => useSoloPanel(dashboard, 'panel-1-clone-1'));
    const panel = findVizPanelByKey(dashboard, 'panel-1');

    expect(result.current[0]).not.toBe(panel);
    expect(result.current[1]).toBeUndefined();
  });

  it('should return error when panelId correspond to a non VizPanel', () => {
    const { dashboard } = setup();
    const { result } = renderHook(() => useSoloPanel(dashboard, 'panel-2'));

    expect(result.current[0]).toBeUndefined();
    expect(result.current[1]).toBe('Panel not found');
  });
});

const setup = () => {
  const dashboard = transformSaveModelToScene({ dashboard: TEST_DASHBOARD, meta: {} });

  return { dashboard };
};

const TEST_DASHBOARD = {
  title: 'Scenes/PanelEdit/Queries: Edit',
  annotations: {
    list: [],
  },
  editable: true,
  fiscalYearStartMonth: 0,
  graphTooltip: 0,
  id: 2378,
  links: [],
  liveNow: false,
  panels: [
    {
      type: 'timeseries',
      datasource: 'prometheus',
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      gridPos: {
        h: 9,
        w: 24,
        x: 0,
        y: 0,
      },
      id: 1,
      options: {
        colorMode: 'background',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull', 'last', 'first', 'min', 'max', 'mean', 'sum', 'count'],
          fields: '',
          values: false,
        },
        text: {},
      },
      pluginVersion: '8.0.3',
    },
    {
      id: 2,
      type: 'row',
    },
  ],
  refresh: '',
  schemaVersion: 39,
  tags: [],
  templating: {
    list: [],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  uid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
  version: 6,
  weekStart: '',
};
