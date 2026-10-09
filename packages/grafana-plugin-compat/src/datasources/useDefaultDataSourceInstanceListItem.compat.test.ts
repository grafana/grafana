import { renderHook } from '@testing-library/react';

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';

import { getMockedDatasourceSrv, getMockedListItem } from '../utils/mocks';

import { useDefaultDataSourceInstanceListItem } from './useDefaultDataSourceInstanceListItem';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDefaultDataSourceInstanceListItem: undefined,
  useDefaultDataSourceInstanceListItem: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();

const alpha = getMockedListItem({ uid: 'ds-a', name: 'A' });
const bravo = getMockedListItem({ uid: 'ds-b', name: 'B' });

function givenDefaultUid(defaultUid?: string) {
  mockDatasourceSrv.getInstanceSettings.mockImplementation(
    (uid: string) => ({ uid, isDefault: uid === defaultUid }) as DataSourceInstanceSettings
  );
}

describe('useDefaultDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should return the default item without a loading phase', () => {
    givenDefaultUid('ds-b');

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(result.current).toEqual({ isLoading: false, item: bravo });
  });

  it('should return undefined when no item is the default', () => {
    givenDefaultUid();

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(result.current.item).toBeUndefined();
  });

  it('should pick up a default that moved between the same items on the next render', () => {
    givenDefaultUid('ds-b');
    const { result, rerender } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    givenDefaultUid('ds-a');
    rerender();

    expect(result.current.item).toBe(alpha);
  });

  it('should return the current item when it changes under the same uid', () => {
    givenDefaultUid('ds-b');
    const { result, rerender } = renderHook(({ items }) => useDefaultDataSourceInstanceListItem(items), {
      initialProps: { items: [alpha, bravo] },
    });

    const renamed = { ...bravo, name: 'B renamed' };
    rerender({ items: [alpha, renamed] });

    expect(result.current.item).toBe(renamed);
  });

  it('should skip a nullish entry rather than throwing on it', () => {
    givenDefaultUid('ds-b');
    const items = [null, bravo] as unknown as DataSourceInstanceListItem[];

    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem(items));

    expect(result.current.item).toBe(bravo);
  });
});
