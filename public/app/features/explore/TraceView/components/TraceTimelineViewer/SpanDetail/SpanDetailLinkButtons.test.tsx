import { of } from 'rxjs';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { CoreApp, type LinkModel, toDataFrame, type TimeRange } from '@grafana/data';
import { locationService, usePluginLinks } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { getDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { SpanLinkType } from '../../types/links';
import { type TraceSpan } from '../../types/trace';

import { getProfileLinkButtonsContext, SpanDetailLinkButtons, RelatedProfilesTitle } from './SpanDetailLinkButtons';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ isLoading: false, links: [] }),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceSettings: jest.fn().mockReturnValue({ isLoading: false, settings: undefined }),
  useDataSourceInstanceList: jest.fn().mockReturnValue({ isLoading: false, items: [] }),
  // LogsLinkButton resolves the query datasource to check for logs; the links used
  // here have no interpolated query, so this is only a safety net against real calls.
  getDataSourceInstance: jest.fn().mockResolvedValue({ query: jest.fn() }),
}));

const span = {
  process: {
    serviceName: 'test-service',
  },
  tags: [{ key: 'pyroscope.profile.id', value: 'test-profile' }],
} as TraceSpan;

const createSpanLink = jest.fn();
const timeRange = {
  from: new Date(0),
  to: new Date(1000),
} as unknown as TimeRange;

// The Share button is always rendered by SpanDetailLinkButtons, so every render
// below produces this button in addition to any link buttons under test.
const focusSpanLink = {
  href: '/focus',
  title: 'Focus',
  target: '_self',
  origin: {},
} as unknown as LinkModel;

describe('SpanDetailLinkButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render only the share button when createSpanLink is not provided', () => {
    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={undefined}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={undefined}
        timeRange={timeRange}
        app={CoreApp.Explore}
        focusSpanLink={focusSpanLink}
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('should render log link button when logs link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Logs, href: '/logs', title: 'Logs' }]);

    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={createSpanLink}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={undefined}
        timeRange={timeRange}
        app={CoreApp.Explore}
        focusSpanLink={focusSpanLink}
      />
    );

    // Log link + the always-present share button.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Related logs')).toBeInTheDocument();
  });

  describe('logs link CTA copy', () => {
    it.each([
      {
        name: 'shows "Related logs" when the datasource has no settings',
        settings: undefined,
        expectedCTA: 'Related logs',
      },
      {
        name: 'shows "Related logs" when neither filterBySpanID nor filterByTraceID is set',
        settings: { jsonData: { tracesToLogsV2: { customQuery: false } } },
        expectedCTA: 'Related logs',
      },
      {
        name: 'shows "Logs for this trace" when filterByTraceID is set',
        settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
        expectedCTA: 'Logs for this trace',
      },
      {
        name: 'shows "Logs for this span" when filterBySpanID is set',
        settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
        expectedCTA: 'Logs for this span',
      },
      {
        name: 'prefers "Logs for this span" when both filterBySpanID and filterByTraceID are set',
        settings: {
          jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true, filterByTraceID: true } },
        },
        expectedCTA: 'Logs for this span',
      },
    ])('$name', ({ settings, expectedCTA }) => {
      (useDataSourceInstanceSettings as jest.Mock).mockReturnValue({ isLoading: false, settings });
      createSpanLink.mockReturnValue([{ type: SpanLinkType.Logs, href: '/logs', title: 'Logs' }]);

      render(
        <SpanDetailLinkButtons
          span={span}
          createSpanLink={createSpanLink}
          datasourceType="test"
          datasourceUid="test-datasource-uid"
          traceToProfilesOptions={undefined}
          timeRange={timeRange}
          app={CoreApp.Explore}
          focusSpanLink={focusSpanLink}
        />
      );

      // Log link + the always-present share button.
      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(screen.getByText(expectedCTA)).toBeInTheDocument();
    });
  });

  it('should render profile link button when profiles link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Profiles, href: '/profiles', title: RelatedProfilesTitle }]);

    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={createSpanLink}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={{
          datasourceUid: 'test-uid',
          profileTypeId: 'test-type',
          customQuery: false,
        }}
        timeRange={timeRange}
        app={CoreApp.Dashboard}
        focusSpanLink={focusSpanLink}
      />
    );

    // Profile link + the always-present share button.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Profiles for this span')).toBeInTheDocument();
  });

  it('should render session link button when session link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Session, href: '/session', title: 'Session' }]);

    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={createSpanLink}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={undefined}
        timeRange={timeRange}
        app={CoreApp.Explore}
        focusSpanLink={focusSpanLink}
      />
    );

    // Session link + the always-present share button.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Session for this span')).toBeInTheDocument();
  });

  it('should render profile drilldown button when plugin link exists', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Profiles, href: '/profiles', title: RelatedProfilesTitle }]);
    (usePluginLinks as jest.Mock).mockReturnValue({
      isLoading: false,
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          title: 'Open in Profiles Drilldown',
          onClick: jest.fn(),
        },
      ],
    });

    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={createSpanLink}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={{
          datasourceUid: 'test-uid',
          profileTypeId: 'test-type',
          customQuery: false,
        }}
        timeRange={timeRange}
        app={CoreApp.Explore}
        focusSpanLink={focusSpanLink}
      />
    );

    // Profile link + profiles drilldown link + the always-present share button.
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('Profiles for this span')).toBeInTheDocument();
    expect(screen.getByText('Open in Profiles Drilldown')).toBeInTheDocument();
  });

  it('should not render profile drilldown button when not in Explore', () => {
    createSpanLink.mockReturnValue([{ type: SpanLinkType.Profiles, href: '/profiles', title: RelatedProfilesTitle }]);
    (usePluginLinks as jest.Mock).mockReturnValue({
      isLoading: false,
      links: [
        {
          pluginId: 'grafana-pyroscope-app',
          title: 'Open in Profiles Drilldown',
          onClick: jest.fn(),
        },
      ],
    });

    render(
      <SpanDetailLinkButtons
        span={span}
        createSpanLink={createSpanLink}
        datasourceType="test"
        datasourceUid="test-datasource-uid"
        traceToProfilesOptions={{
          datasourceUid: 'test-uid',
          profileTypeId: 'test-type',
          customQuery: false,
        }}
        timeRange={timeRange}
        app={CoreApp.Dashboard}
        focusSpanLink={focusSpanLink}
      />
    );

    // Profile link + the always-present share button (no drilldown outside Explore).
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Profiles for this span')).toBeInTheDocument();
    expect(screen.queryByText('Open in Profiles Drilldown')).not.toBeInTheDocument();
  });

  describe('logs link click-through', () => {
    afterEach(() => {
      // The rendered LogsLinkButton is still mounted at this point (RTL's own cleanup
      // runs after this hook), and it reacts to the flag change, so wrap it in act().
      act(() => {
        setTestFlags({});
      });
    });

    it("opens the discovered href, not the link's original pre-discovery href", async () => {
      setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });

      const query = jest.fn().mockReturnValue(of({ data: [toDataFrame({ fields: [{ name: 'time', values: [1] }] })] }));
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ query, type: 'loki' });

      // The href/onClick a Logs link starts with, before the presence-check discovers
      // which query variation actually has logs and rewrites the link in place.
      createSpanLink.mockReturnValue([
        {
          type: SpanLinkType.Logs,
          href: '/logs-initial',
          title: 'Logs',
          field: {},
          linkModel: {
            href: '/logs-initial',
            title: 'Logs',
            target: '_self',
            origin: {},
            interpolatedParams: {
              query: { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' }, expr: '{job="api"} |= "t1"' },
              alternativeQueries: [
                { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' }, expr: '{job="api"} |= "t1"' },
              ],
            },
          },
        },
      ]);

      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
      const pushSpy = jest.spyOn(locationService, 'push');

      render(
        <SpanDetailLinkButtons
          span={span}
          createSpanLink={createSpanLink}
          datasourceType="test"
          datasourceUid="test-datasource-uid"
          traceToProfilesOptions={undefined}
          timeRange={timeRange}
          app={CoreApp.Explore}
          focusSpanLink={focusSpanLink}
        />
      );

      // Wait for the presence check to resolve and rewrite the link in place.
      await waitFor(() =>
        expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('/explore?left='))
      );
      const discoveredHref = screen.getByRole('link').getAttribute('href');
      expect(discoveredHref).not.toBe('/logs-initial');

      await userEvent.click(screen.getByRole('link'));

      // The click must navigate to the discovered href, not the stale pre-discovery one,
      // and — since this is a Logs link — always via a new tab, never in-place.
      expect(openSpy).toHaveBeenCalledWith(discoveredHref, '_blank', 'noopener,noreferrer');
      expect(pushSpy).not.toHaveBeenCalled();

      openSpy.mockRestore();
      pushSpy.mockRestore();
      (getDataSourceInstance as jest.Mock).mockResolvedValue({ query: jest.fn() });
    });
  });
});

describe('getProfileLinkButtonsContext', () => {
  const traceToProfilesOptions = {
    datasourceUid: 'test-uid',
    profileTypeId: 'test-type',
    customQuery: false,
  };

  it('should create context with all properties', () => {
    const context = getProfileLinkButtonsContext(span, traceToProfilesOptions, timeRange);

    expect(context).toEqual({
      serviceName: 'test-service',
      profileTypeId: 'test-type',
      spanSelector: ['test-profile'],
      explorationType: 'flame-graph',
      timeRange: {
        from: new Date(0).toISOString(),
        to: new Date(1000).toISOString(),
      },
      datasource: {
        uid: 'test-uid',
      },
    });
  });

  it('should handle missing traceToProfilesOptions', () => {
    const context = getProfileLinkButtonsContext(span, undefined, timeRange);

    expect(context).toEqual({
      serviceName: 'test-service',
      profileTypeId: '',
      spanSelector: ['test-profile'],
      explorationType: 'flame-graph',
      timeRange: {
        from: new Date(0).toISOString(),
        to: new Date(1000).toISOString(),
      },
      datasource: {
        uid: undefined,
      },
    });
  });

  it('should handle missing service name', () => {
    const spanWithoutService = {
      process: {},
      tags: [{ key: 'pyroscope.profile.id', value: 'test-profile' }],
    } as TraceSpan;

    const context = getProfileLinkButtonsContext(spanWithoutService, traceToProfilesOptions, timeRange);

    expect(context.serviceName).toBe('');
  });

  it('should handle missing profile ID tag', () => {
    const spanWithoutProfileId = {
      process: { serviceName: 'test-service' },
      tags: [],
    } as unknown as TraceSpan;

    const context = getProfileLinkButtonsContext(spanWithoutProfileId, traceToProfilesOptions, timeRange);

    expect(context.spanSelector).toEqual([]);
  });
});
