import { defaultDataQueryKind, PanelQueryKind, PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { CustomTimeRangeCompare } from '../../scene/CustomTimeRangeCompare';

import { buildVizPanel, getRuntimePanelDataSource } from './utils';

// Mock the config needed for the function
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
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
      '-- Grafana --': {
        uid: 'grafana',
        name: 'Grafana',
        meta: { id: 'grafana' },
        type: 'datasource',
      },
    },
    featureToggles: {
      timeComparison: false,
    },
  },
}));

// Mock what's essential for behaviors tests
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
      kind: 'VizConfig',
      group: 'timeseries',
      version: '1.0.0',
      spec: {
        options: {},
        fieldConfig: { defaults: {}, overrides: [] },
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
  describe('behaviors', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should include CustomTimeRangeCompare in $behaviors when timeComparison feature toggle is enabled', () => {
      // Mock config with timeComparison enabled
      const mockConfig = require('@grafana/runtime').config;
      mockConfig.featureToggles.timeComparison = true;

      const panel = createTestPanel();
      const vizPanel = buildVizPanel(panel);

      expect(vizPanel.state.$behaviors).toBeDefined();
      expect(vizPanel.state.$behaviors).toHaveLength(1);
      expect(CustomTimeRangeCompare).toHaveBeenCalledWith({
        compareWith: undefined,
        compareOptions: [],
      });
    });

    it('should have empty $behaviors array when timeComparison feature toggle is disabled', () => {
      // Mock config with timeComparison disabled
      const mockConfig = require('@grafana/runtime').config;
      mockConfig.featureToggles.timeComparison = false;

      const panel = createTestPanel();
      const vizPanel = buildVizPanel(panel);

      expect(vizPanel.state.$behaviors).toBeDefined();
      expect(vizPanel.state.$behaviors).toHaveLength(0);
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
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          datasource: {
            name: 'prometheus-uid',
          },
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      uid: 'prometheus-uid',
      type: 'prometheus',
    });
  });

  it('should prioritize default datasource when it matches the query kind', () => {
    const query: PanelQueryKind = {
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

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
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'loki',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

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
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'unknown-type',
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

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
        query: {
          kind: 'DataQuery',
          version: defaultDataQueryKind().version,
          group: 'prometheus',
          datasource: {
            name: '',
          },
          spec: {},
        },
      },
    };

    const result = getRuntimePanelDataSource(query.spec.query);

    expect(result).toEqual({
      uid: 'default-prometheus-uid',
      type: 'prometheus',
    });
  });
});
