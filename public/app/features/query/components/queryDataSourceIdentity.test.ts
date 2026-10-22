import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { getQueryDataSourceIdentity } from './queryDataSourceIdentity';

const mockReplace = jest.fn((target?: string) => target ?? '');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (target?: string, _scopedVars?: unknown, format?: (value: unknown) => unknown) => {
      const interpolated = mockReplace(target);
      return format ? format(interpolated) : interpolated;
    },
    getVariables: () => [],
    containsTemplate: () => false,
    updateTimeRange: () => {},
  }),
}));

describe('getQueryDataSourceIdentity', () => {
  afterEach(() => {
    mockReplace.mockImplementation((target?: string) => target ?? '');
  });

  it('returns a string ref as-is when it is not a variable', () => {
    expect(getQueryDataSourceIdentity('prom-uid')).toBe('prom-uid');
  });

  it('returns an object ref uid as-is when it is not a variable', () => {
    expect(getQueryDataSourceIdentity({ uid: '-100', type: '__expr__' })).toBe('-100');
    expect(getQueryDataSourceIdentity({ uid: 'default', type: 'prometheus' })).toBe('default');
  });

  it('interpolates a template variable uid', () => {
    mockReplace.mockImplementation((target?: string) => (target === '${ds}' ? 'prom-uid' : (target ?? '')));

    expect(getQueryDataSourceIdentity({ uid: '${ds}', type: 'prometheus' })).toBe('prom-uid');
    expect(mockReplace).toHaveBeenCalledWith('${ds}');
  });

  it('falls back to the group settings when the query has no datasource uid', () => {
    const fallback = mockDataSource({ uid: 'group-uid', name: 'Prometheus' });

    expect(getQueryDataSourceIdentity(undefined, undefined, fallback)).toBe('group-uid');
    expect(getQueryDataSourceIdentity({ type: 'prometheus' }, undefined, fallback)).toBe('group-uid');
  });

  it('prefers fallback.rawRef.uid when the query has no datasource uid', () => {
    const fallback = {
      ...mockDataSource({ uid: '${ds}', name: '${ds}' }),
      rawRef: { uid: 'prom-uid', type: 'prometheus' },
    };

    expect(getQueryDataSourceIdentity(undefined, undefined, fallback)).toBe('prom-uid');
  });

  it('returns undefined when there is no uid and no fallback', () => {
    expect(getQueryDataSourceIdentity(undefined)).toBeUndefined();
  });
});
