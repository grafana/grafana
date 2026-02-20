import { renderHook } from '@testing-library/react';

import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { PanelTimeRange } from '../../../../scene/panel-timerange/PanelTimeRange';
import { ds1SettingsMock } from '../testUtils';

import { useQueryOptions } from './useQueryOptions';

describe('useQueryOptions', () => {
  it('should build QueryGroupOptions from panel, queryRunner, and datasource state', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      $timeRange: new PanelTimeRange({
        timeFrom: 'now-1h',
        timeShift: '1d',
        hideTimeOverride: false,
      }),
    });

    const queryRunner = new SceneQueryRunner({
      queries: [],
      maxDataPoints: 2000,
      minInterval: '10s',
    });

    const { result } = renderHook(() =>
      useQueryOptions({
        panel,
        queryRunner,
        dsSettings: ds1SettingsMock,
      })
    );

    expect(result.current.maxDataPoints).toBe(2000);
    expect(result.current.minInterval).toBe('10s');
    expect(result.current.timeRange).toEqual({
      from: 'now-1h',
      shift: '1d',
      hide: false,
    });
    expect(result.current.dataSource.uid).toBe('test');
  });

  it('should conditionally include cacheTimeout and queryCachingTTL based on datasource capabilities', () => {
    const dsWithCaching = {
      ...ds1SettingsMock,
      meta: {
        ...ds1SettingsMock.meta,
        queryOptions: {
          cacheTimeout: true,
        },
      },
      cachingConfig: {
        enabled: true,
      },
    };

    const panel = new VizPanel({ key: 'panel-1' });
    const queryRunner = new SceneQueryRunner({
      queries: [],
      cacheTimeout: '60',
      queryCachingTTL: 300000,
    });

    const { result } = renderHook(() =>
      useQueryOptions({
        panel,
        queryRunner,
        dsSettings: dsWithCaching,
      })
    );

    expect(result.current.cacheTimeout).toBe('60');
    expect(result.current.queryCachingTTL).toBe(300000);

    // Now test without caching support
    const { result: resultNoCaching } = renderHook(() =>
      useQueryOptions({
        panel,
        queryRunner,
        dsSettings: ds1SettingsMock,
      })
    );

    expect(resultNoCaching.current.cacheTimeout).toBeUndefined();
    expect(resultNoCaching.current.queryCachingTTL).toBeUndefined();
  });
});
