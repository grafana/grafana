import { render } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  CoreApp,
  dateTime,
  type LinkModel,
  PluginExtensionPoints,
  PluginExtensionTypes,
  type TimeRange,
} from '@grafana/data';
import { setPluginLinksHook } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { LogLinksResolver } from './LogLinksResolver';
import { LogListContext, useLogListContext } from './LogListContext';

const TRACE_ID = '2203801e0171aa8b';
const TRACES_PATH = '/a/grafana-exploretraces-app/explore?var-ds=tempo-uid';

const pluginLinksHook = jest.fn();

function exploreLink(query: string, queryType: string): LinkModel {
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
        queryType,
      } as DataQuery,
      timeRange: {
        from: dateTime('2026-01-01T00:00:00Z'),
        to: dateTime('2026-01-01T01:00:00Z'),
        raw: { from: 'now-1h', to: 'now' },
      } satisfies TimeRange,
    },
  };
}

function WithApp({ app, children }: { app: CoreApp; children: ReactNode }) {
  const context = useLogListContext();
  return <LogListContext.Provider value={{ ...context, app }}>{children}</LogListContext.Provider>;
}

function renderResolver(links: readonly LinkModel[]) {
  let received: readonly LinkModel[] | undefined;
  render(
    <WithApp app={CoreApp.Unknown}>
      <LogLinksResolver links={links}>
        {(resolved) => {
          received = resolved;
          return null;
        }}
      </LogLinksResolver>
    </WithApp>
  );
  return received;
}

describe('LogLinksResolver', () => {
  beforeEach(() => {
    pluginLinksHook.mockReset();
    pluginLinksHook.mockReturnValue({
      isLoading: false,
      links: [
        {
          id: 'traces',
          type: PluginExtensionTypes.link,
          pluginId: 'grafana-exploretraces-app',
          title: 'Open in Grafana Traces Drilldown',
          description: '',
          path: TRACES_PATH,
        },
      ],
    });
    setPluginLinksHook(pluginLinksHook);
  });

  it('rewrites a TraceQL Explore link that looks up a Tempo trace', () => {
    const link = exploreLink(TRACE_ID, 'traceql');

    const received = renderResolver([link]);

    expect(pluginLinksHook).toHaveBeenCalledWith({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      limitPerPlugin: 1,
      context: {
        targets: [
          {
            refId: 'A',
            datasource: { uid: 'tempo-uid', type: 'tempo' },
            query: TRACE_ID,
            queryType: 'traceql',
          },
        ],
        timeRange: { from: 'now-1h', to: 'now' },
      },
    });
    expect(received?.[0]).toEqual({
      ...link,
      href: `${TRACES_PATH}&traceId=${TRACE_ID}`,
      title: 'View in Traces Drilldown',
      target: '_blank',
      onClick: undefined,
    });
  });

  it.each([
    {
      desc: 'the query type is not TraceQL',
      query: TRACE_ID,
      queryType: 'search',
    },
    {
      desc: 'the TraceQL query is not a trace id lookup',
      query: '{ resource.service.name = "checkout" }',
      queryType: 'traceql',
    },
  ])('keeps the Explore link when $desc', ({ query, queryType }) => {
    const link = exploreLink(query, queryType);
    const links = [link];

    expect(renderResolver(links)).toBe(links);
    expect(link).toMatchObject({
      href: '/explore?left=abc',
      title: 'tempo',
      target: '_self',
    });
    expect(pluginLinksHook).not.toHaveBeenCalled();
  });
});
