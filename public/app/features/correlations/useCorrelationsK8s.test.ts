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

describe('useCorrelationK8s.ts', () => {
  describe('toEnrichedCorrelationDataK8s', () => {
    it('not finding a source ds should return undefined', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        apiVersion: 'test',
        kind: 'test',
        metadata: {},
        spec: {
          config: { field: 'test', target: {} },
          label: 'test',
          source: { group: 'notFoundGroup', name: 'notFoundUid' },
          type: 'query',
        },
      });
      expect(correlation).toBe(undefined);
    });

    it('should return a query correlation as expected', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        metadata: { name: 'test' },
        apiVersion: 'test',
        kind: 'test',
        spec: {
          config: { field: 'test', target: { randomKey: 'randomValue' } },
          label: 'test',
          source: { group: 'foundGroup', name: 'foundName' },
          target: { group: 'targetGroup', name: 'targetName' },
          type: 'query',
        },
      });
      expect(correlation).toStrictEqual({
        config: { field: 'test', target: { randomKey: 'randomValue' }, transformations: undefined },
        description: undefined,
        label: 'test',
        provisioned: false,
        source: { type: 'foundName', uid: 'foundName' },
        target: { type: 'targetName', uid: 'targetName' },
        targetUID: 'targetName',
        type: 'query',
        uid: 'test',
      });
    });
    it('should return an external correlation as expected', () => {
      const correlation = toEnrichedCorrelationDataK8s({
        metadata: { name: 'test' },
        apiVersion: 'test',
        kind: 'test',
        spec: {
          config: { field: 'test', target: { url: 'testURL' } },
          label: 'test',
          source: { group: 'foundGroup', name: 'foundName' },
          type: 'external',
        },
      });
      expect(correlation).toStrictEqual({
        config: { field: 'test', target: { url: 'testURL' }, transformations: undefined },
        description: undefined,
        label: 'test',
        provisioned: false,
        source: { type: 'foundName', uid: 'foundName' },
        type: 'external',
        uid: 'test',
      });
    });
  });
});
