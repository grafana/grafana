import { type Panel } from '@grafana/schema';

import { buildPanelElementFromPlugin } from './buildPanelElementFromPlugin';

const datasource = { type: 'loki', uid: 'loki-1' };

describe('buildPanelElementFromPlugin', () => {
  it('carries the queries, title, and datasource into the panel element', () => {
    const targets: Panel['targets'] = [
      { refId: 'A', expr: '{app="checkout"}' },
      { refId: 'B', hide: true },
    ];

    const element = buildPanelElementFromPlugin({
      title: 'Checkout latency',
      targets,
      datasource,
      type: '',
    });

    expect(element.kind).toBe('Panel');
    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.title).toBe('Checkout latency');
    expect(element.spec.vizConfig.group).toBe('timeseries');
    expect(element.spec.data.spec.queries).toHaveLength(2);
    expect(element.spec.data.spec.queries[0].spec.refId).toBe('A');
    expect(element.spec.data.spec.queries[1].spec.hidden).toBe(true);
    expect(element.spec.data.spec.queries[0].spec.query.datasource).toEqual({ name: 'loki-1' });
    // PanelModel writes refIds onto queries that lack them. That write must not land on the
    // plugin's own objects.
    expect(targets[0]).toEqual({ refId: 'A', expr: '{app="checkout"}' });
  });

  it('uses the visualization plugin the caller named', () => {
    const element = buildPanelElementFromPlugin({
      targets: [{ refId: 'A' }],
      type: 'stat',
    });

    expect(element.kind === 'Panel' && element.spec.vizConfig.group).toBe('stat');
  });

  it('stores maxDataPoints, interval, cacheTimeout, and queryCachingTTL on the panel element', () => {
    const element = buildPanelElementFromPlugin({
      title: 'Checkout latency',
      type: 'timeseries',
      targets: [{ refId: 'A' }],
      maxDataPoints: 100,
      interval: '10s',
      cacheTimeout: '1m',
      queryCachingTTL: 60,
    });

    expect(element.kind).toBe('Panel');
    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.queryOptions).toEqual({
      maxDataPoints: 100,
      interval: '10s',
      cacheTimeout: '1m',
      queryCachingTTL: 60,
    });
  });

  it('names an untitled panel "New panel" and defaults the visualization to timeseries', () => {
    const element = buildPanelElementFromPlugin({
      targets: [{ refId: 'A' }],
      type: '',
    });

    expect(element.kind === 'Panel' && element.spec.title).toBe('New panel');
    expect(element.kind === 'Panel' && element.spec.vizConfig.group).toBe('timeseries');
  });
});
