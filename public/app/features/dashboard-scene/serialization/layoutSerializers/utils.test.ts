import { PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { getRuntimePanelDataSource } from './utils';

// Mock the config needed for the function
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      settings: {
        defaultDatasource: 'default-ds-grafana',
        datasources: {
          'default-ds-grafana': {
            uid: 'default-ds-uid',
            name: 'Default DS',
            meta: { id: 'default-ds-grafana' },
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

  it('should infer datasource based on query kind when datasource is not specified', () => {
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
      uid: 'prometheus-uid',
      type: 'prometheus',
    });
  });

  it('should use default datasource when no datasource is specified and query kind does not match any available datasource', () => {
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
      uid: 'default-ds-uid',
      type: 'default-ds-grafana',
    });
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
      uid: 'prometheus-uid',
      type: 'prometheus',
    });
  });
});
