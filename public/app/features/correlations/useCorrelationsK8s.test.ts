import { renderHook } from '@testing-library/react';

import { useListCorrelationQuery } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { SupportedTransformationType } from '@grafana/data';
import { type DataSourceRef } from '@grafana/schema/dist/esm/index';

import { toEnrichedCorrelationDataK8s, useCorrelationsK8s } from './useCorrelationsK8s';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: (ref: DataSourceRef | string) => {
    const uid = typeof ref === 'string' ? ref : ref.uid;
    if (uid !== 'notFoundUid') {
      return Promise.resolve(typeof ref === 'string' ? { uid: ref, type: ref } : ref);
    } else {
      return Promise.resolve(undefined);
    }
  },
}));

jest.mock('@grafana/api-clients/rtkq/correlations/v0alpha1', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/correlations/v0alpha1'),
  useListCorrelationQuery: jest.fn(),
}));

const useListCorrelationMock = useListCorrelationQuery as jest.Mock;

describe('useCorrelationsK8s', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toEnrichedCorrelationDataK8s', () => {
    it('returns undefined if the source datasource is not found', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
        },
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
    it('returns undefined if its a query correlation and the targetDS is not found', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
        },
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
    it('returns an external correlation', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
        },
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
    it('returns a query correlation', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
        },
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
    it('maps non-regex transformations to logfmt and defaults a missing target url', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
        },
        spec: {
          label: 'testLabel',
          description: 'testDesc',
          source: { group: 'notFoundGroup', name: 'foundUid' },
          type: 'external',
          config: { field: 'testField', target: {}, transformations: [{ type: 'logfmt' }] },
        },
      });

      expect(correlation).toStrictEqual({
        config: {
          field: 'testField',
          target: { url: '' },
          transformations: [{ type: SupportedTransformationType.Logfmt }],
        },
        description: 'testDesc',
        label: 'testLabel',
        provisioned: false,
        source: { type: 'foundUid', uid: 'foundUid' },
        type: 'external',
        uid: 'testUid',
      });
    });

    it('marks a correlation with a manager as provisioned', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: { name: 'testUid', annotations: { 'grafana.app/managedBy': 'something' } },
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
        provisioned: true,
        source: { type: 'foundUid', uid: 'foundUid' },
        target: { type: 'foundUid', uid: 'foundUid' },
        targetUID: 'foundUid',
        type: 'query',
        uid: 'testUid',
      });
    });

    it('marks a correlation with a manager that allows edits as not provisioned', async () => {
      const correlation = await toEnrichedCorrelationDataK8s({
        apiVersion: 'testApiVer',
        kind: 'testKind',
        metadata: {
          name: 'testUid',
          annotations: {
            'grafana.app/managedBy': 'something',
            'grafana.app/managerAllowsEdits': 'true',
          },
        },
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

  it('should pass the right limit based on page size', async () => {
    useListCorrelationMock.mockReturnValue({ data: [] });
    renderHook(() => useCorrelationsK8s(10, 5));
    expect(useListCorrelationMock).toHaveBeenCalledWith({ limit: 50 });
  });

  it('returns a formatted error when the list query fails', async () => {
    useListCorrelationMock.mockReturnValue({ error: { status: 500 } });
    const { result } = renderHook(() => useCorrelationsK8s(10, 1));
    expect(result.current.error).toBeDefined();
  });
});
