import { defaultDataQueryKind, PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getRuntimePanelDataSource } from './utils';

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
