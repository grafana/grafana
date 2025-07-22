import { PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { getRuntimePanelDataSource } from './utils';

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
  },
}));

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
