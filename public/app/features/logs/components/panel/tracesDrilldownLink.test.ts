import { type LinkModel, type PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { appendTraceId, buildTracesDrilldownContext, resolveTracesDrilldownLinks } from './tracesDrilldownLink';

const TRACE_ID = '2203801e0171aa8b';

function tempoLink(query = TRACE_ID): LinkModel {
  return {
    href: '/explore?left=abc',
    title: 'tempo',
    target: '_self',
    origin: undefined,
    onClick: jest.fn(),
    interpolatedParams: {
      query: {
        refId: 'A',
        datasource: { uid: 'tempo-uid' },
        query,
        queryType: 'traceql',
      } as DataQuery,
      timeRange: {
        from: 'now-1h' as never,
        to: 'now' as never,
        raw: { from: 'now-1h', to: 'now' },
      },
    },
  };
}

function extensionLink(path = '/a/grafana-exploretraces-app/explore?var-ds=tempo-uid'): PluginExtensionLink {
  return {
    id: 'traces',
    type: PluginExtensionTypes.link,
    pluginId: 'grafana-exploretraces-app',
    title: 'Open in Grafana Traces Drilldown',
    description: '',
    path,
  };
}

describe('resolveTracesDrilldownLinks', () => {
  it('opens an Explore trace link in a new tab and drops the Explore click handler', () => {
    const link = tempoLink();
    const [resolved] = resolveTracesDrilldownLinks([link], [extensionLink()]);

    expect(resolved.href).toBe(`/a/grafana-exploretraces-app/explore?var-ds=tempo-uid&traceId=${TRACE_ID}`);
    expect(resolved.title).toBe('View in Traces Drilldown');
    expect(resolved.target).toBe('_blank');
    expect(resolved.onClick).toBeUndefined();
  });

  it('uses the trace id from a TraceQL lookup', () => {
    const [resolved] = resolveTracesDrilldownLinks([tempoLink(`{ trace:id = "${TRACE_ID}" }`)], [extensionLink()]);

    expect(resolved.href).toBe(`/a/grafana-exploretraces-app/explore?var-ds=tempo-uid&traceId=${TRACE_ID}`);
  });

  it('keeps the Explore link when Traces Drilldown did not return a path', () => {
    const link = tempoLink();
    const [resolved] = resolveTracesDrilldownLinks([link], []);

    expect(resolved).toBe(link);
  });

  it('keeps links that are not Explore trace lookups', () => {
    const link = tempoLink();
    link.href = 'https://example.com/trace';
    const [resolved] = resolveTracesDrilldownLinks([link], [extensionLink()]);

    expect(resolved).toBe(link);
  });
});

describe('buildTracesDrilldownContext', () => {
  it('sends the Tempo query to the Traces Drilldown extension', () => {
    expect(buildTracesDrilldownContext(tempoLink())).toEqual({
      targets: [
        {
          refId: 'A',
          datasource: { uid: 'tempo-uid', type: 'tempo' },
          query: TRACE_ID,
          queryType: 'traceql',
        },
      ],
      timeRange: { from: 'now-1h', to: 'now' },
    });
  });
});

describe('appendTraceId', () => {
  it('adds traceId without dropping existing params', () => {
    expect(appendTraceId('/a/grafana-exploretraces-app/explore?var-ds=tempo-uid', TRACE_ID)).toBe(
      `/a/grafana-exploretraces-app/explore?var-ds=tempo-uid&traceId=${TRACE_ID}`
    );
  });
});
