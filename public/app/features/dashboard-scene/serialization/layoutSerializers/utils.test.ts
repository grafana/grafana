import { PanelQueryKind, PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { CustomTimeRangeCompare } from '../../scene/CustomTimeRangeCompare';

import { buildVizPanel, getRuntimePanelDataSource } from './utils';

// Mock the config needed for the function
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      settings: {
        defaultDatasource: 'default-ds-prometheus',
        datasources: {
          'default-ds-prometheus': {
            uid: 'default-prometheus-uid',
            name: 'Default Prometheus',
            meta: { id: 'prometheus' },
            type: 'datasource',
          },
          prometheus: {
            uid: 'prometheus-uid',
            name: 'Prometheus',
            meta: { id: 'prometheus' },
            type: 'datasource',
          },
          loki: {
            uid: 'loki-uid',
            name: 'Loki',
            meta: { id: 'loki' },
            type: 'datasource',
          },
        },
      },
    },
    featureToggles: {
      timeComparison: false,
    },
  },
}));

// Mock only what's essential for header actions tests
jest.mock('../../scene/CustomTimeRangeCompare', () => ({
  CustomTimeRangeCompare: jest.fn(),
}));

// Helper function to create a minimal panel for testing
const createTestPanel = (): PanelKind => ({
  kind: 'Panel',
  spec: {
    id: 1,
    title: 'Test Panel',
    description: '',
    vizConfig: {
      kind: 'timeseries',
      spec: {
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
        pluginVersion: '1.0.0',
      },
    },
    data: {
      kind: 'QueryGroup',
      spec: {
        queries: [],
        queryOptions: {},
        transformations: [],
      },
    },
    links: [],
  },
});

describe('buildVizPanel', () => {
  describe('header actions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include CustomTimeRangeCompare in headerActions when timeComparison feature toggle is enabled', () => {
      // Mock config with timeComparison enabled
      const mockConfig = require('@grafana/runtime').config;
      mockConfig.featureToggles.timeComparison = true;

      const panel = createTestPanel();
      const vizPanel = buildVizPanel(panel);

      expect(vizPanel.state.headerActions).toBeDefined();
      expect(vizPanel.state.headerActions).toHaveLength(1);
      expect(CustomTimeRangeCompare).toHaveBeenCalledWith({
        key: 'time-compare',
        compareWith: undefined,
        compareOptions: [],
      });
    });

    it('should not include headerActions when timeComparison feature toggle is disabled', () => {
      // Mock config with timeComparison disabled
      const mockConfig = require('@grafana/runtime').config;
      mockConfig.featureToggles.timeComparison = false;

      const panel = createTestPanel();
      const vizPanel = buildVizPanel(panel);

      expect(vizPanel.state.headerActions).toBeUndefined();
      expect(CustomTimeRangeCompare).not.toHaveBeenCalled();
    });
  });
});

describe('getRuntimePanelDataSource', () => {
  it('should return the datasource when it is specified in the query', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        datasource: {
          uid: 'test-ds-uid',
          type: 'test-ds-type',
        },
        query: {
          kind: 'prometheus',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query);

    expect(result).toEqual({
      uid: 'test-ds-uid',
      type: 'test-ds-type',
    });
  });

  it('should prioritize default datasource when it matches the query kind', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        datasource: undefined,
        query: {
          kind: 'prometheus',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query);

    expect(result).toEqual({
      uid: 'default-prometheus-uid',
      type: 'prometheus',
    });
  });

  it('should fall back to first available datasource when default datasource type does not match query kind', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        datasource: undefined,
        query: {
          kind: 'loki',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query);

    expect(result).toEqual({
      uid: 'loki-uid',
      type: 'loki',
    });
  });

  it('should use default datasource when no datasource is specified and query kind does not match any available datasource', () => {
    jest.spyOn(console, 'warn').mockImplementation();
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        datasource: undefined,
        query: {
          kind: 'unknown-type',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query);

    expect(result).toEqual({
      uid: 'default-prometheus-uid',
      type: 'prometheus',
    });

    expect(console.warn).toHaveBeenCalledWith(
      'Could not find datasource for query kind unknown-type, defaulting to prometheus'
    );
  });

  it('should handle the case when datasource uid is empty string', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        datasource: {
          uid: '',
          type: 'test-ds-type',
        },
        query: {
          kind: 'prometheus',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query);

    expect(result).toEqual({
      uid: 'default-prometheus-uid',
      type: 'prometheus',
    });
  });
});
