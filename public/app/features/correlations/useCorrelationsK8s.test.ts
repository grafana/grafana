import { DataSourceRef } from '@grafana/schema/dist/esm/index';

import { toEnrichedCorrelationDataK8s } from './useCorrelationsK8s';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getInstanceSettings: (ref: DataSourceRef) => {
      if (ref.uid !== 'notFoundUid') {
        return typeof ref === 'string' ? { uid: ref, type: ref } : ref;
      } else {
        return undefined;
      }
    },
  }),
}));

describe('useCorrelationsK8s', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toEnrichedCorrelationDataK8s', () => {
    it('returns undefined if the datasource is not found', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: { name: 'testUid' },
        spec: {
          label: 'testLabel',
          description: 'testDesc',
          source: { group: 'notFoundGroup', name: 'notFoundUid' },
          type: 'external',
          config: { field: 'testField', target: { url: 'testUrl' } },
        },
      });

      expect(correlation).toBe(undefined);
    });
    it('returns undefined if its a query correlation and the targetDS is not found', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: { name: 'testUid' },
        spec: {
          label: 'testLabel',
          description: 'testDesc',
          source: { group: 'notFoundGroup', name: 'foundUid' },
          target: { group: 'notFoundGroup', name: 'notFoundUid' },
          type: 'query',
          config: { field: 'testField', target: { url: 'testUrl' } },
        },
      });

      expect(correlation).toBe(undefined);
    });
    it('returns an external correlation', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: { name: 'testUid' },
        spec: {
          label: 'testLabel',
          description: 'testDesc',
          source: { group: 'notFoundGroup', name: 'foundUid' },
          type: 'external',
          config: { field: 'testField', target: { url: 'testUrl' } },
        },
      });

      expect(correlation).toStrictEqual({
        config: { field: 'testField', target: { url: 'testUrl' }, transformations: undefined },
        description: 'testDesc',
        label: 'testLabel',
        provisioned: false,
        source: { type: 'foundUid', uid: 'foundUid' },
        type: 'external',
        uid: 'testUid',
      });
    });
    it('returns a query correlation', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: { name: 'testUid' },
        spec: {
          label: 'testLabel',
          description: 'testDesc',
          source: { group: 'notFoundGroup', name: 'foundUid' },
          target: { group: 'notFoundGroup', name: 'foundUid' },
          type: 'query',
          config: { field: 'testField', target: { url: 'testUrl' } },
        },
      });

      expect(correlation).toStrictEqual({
        config: { field: 'testField', target: { url: 'testUrl' }, transformations: undefined },
        description: 'testDesc',
        label: 'testLabel',
        provisioned: false,
        source: { type: 'foundUid', uid: 'foundUid' },
        target: { type: 'foundUid', uid: 'foundUid' },
        targetUID: 'foundUid',
        type: 'query',
        uid: 'testUid',
      });
    });
  });
});
