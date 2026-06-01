/**
 * Integration tests for bug #123832:
 *   "Dashboards: ${__interval} in panel link URL not interpolated until panel is activated;
 *    stale after time-range change"
 *
 * The flow under test is the same as the user-facing one:
 *   click → getPanelLinks(panel) → getScenePanelLinksSupplier → LinkSrv.getDataLinkUIModel
 *          → sceneGraph.interpolate → IntervalMacro → URL is what the browser will navigate to.
 *
 * These tests intentionally drive the public helper `getPanelLinks` directly (the same helper
 * used by both the single-link renderer and the multi-link menu behavior) and inspect the
 * resulting LinkModel.href. They do NOT mock the variable / link / interpolation pipeline.
 */

import { LoadingState, type PanelData, dateTime, type DataQueryRequest } from '@grafana/data';
import {
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
import { getPanelLinks, panelLinksBehavior } from './PanelMenuBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// The DashboardInteractions side-effect runs on click; tests don't click, so this is just a guard.
jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    panelLinkClicked: jest.fn(),
  },
}));

interface BuildOptions {
  /** Raw time range used by the dashboard's SceneTimeRange. Default 'now-6h' -> 'now'. */
  from?: string;
  to?: string;
  /** SceneQueryRunner.maxDataPoints — kept explicit so the calculated interval is deterministic. */
  maxDataPoints?: number;
  /** SceneQueryRunner.minInterval, passed through verbatim. */
  minInterval?: string;
  /** URL template used for the panel link. */
  url?: string;
  /** Multiple links — exercises the menu (panelLinksBehavior) path. */
  links?: Array<{ title: string; url: string }>;
}

function buildScene(opts: BuildOptions = {}) {
  const {
    from = 'now-6h',
    to = 'now',
    maxDataPoints = 500,
    minInterval,
    url = 'https://example.com/?interval=${__interval}&intervalMs=${__interval_ms}',
    links,
  } = opts;

  const rawLinks = links
    ? links.map((l) => ({ title: l.title, url: l.url, targetBlank: true }))
    : [{ title: 'Repro link', url, targetBlank: true }];

  const panelLinksMenu = new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] });
  const panelLinks = new VizPanelLinks({
    rawLinks,
    menu: panelLinksMenu,
  });

  const queryRunner = new SceneQueryRunner({
    datasource: { uid: 'test-uid' },
    queries: [{ refId: 'A' }],
    maxDataPoints,
    minInterval,
  });

  const panel = new VizPanel({
    title: 'Repro panel',
    pluginId: 'timeseries',
    key: 'panel-1',
    titleItems: [panelLinks],
    $data: queryRunner,
  });

  const scene = new DashboardScene({
    title: 'Bug #123832 scene',
    uid: 'bug-123832',
    $timeRange: new SceneTimeRange({ from, to }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  return { scene, panel, queryRunner, panelLinks, panelLinksMenu };
}

/**
 * Simulate the SceneQueryRunner state left behind by a prior, completed query at the
 * given interval. The real runner writes this onto `state.data` after `runQueries`
 * completes. We set the same shape so the bug — IntervalMacro reading `request.interval`
 * out of this cache — reproduces deterministically without needing a real datasource.
 */
function setStaleRequestInterval(queryRunner: SceneQueryRunner, intervalMs: number) {
  const now = Date.now();
  const range = {
    from: dateTime(now - 6 * 60 * 60 * 1000),
    to: dateTime(now),
    raw: { from: 'now-6h', to: 'now' },
  };

  const request: Partial<DataQueryRequest> = {
    requestId: 'stale-1',
    interval: `${intervalMs / 1000}s`,
    intervalMs,
    range,
    rangeRaw: range.raw,
    targets: [{ refId: 'A' }],
    scopedVars: {},
    timezone: 'browser',
    app: 'scenes',
    startTime: now,
    maxDataPoints: 500,
  };

  const data: PanelData = {
    state: LoadingState.Done,
    series: [],
    timeRange: range,
    request: request as DataQueryRequest,
  };

  queryRunner.setState({ data });
}

describe('panel-link ${__interval} interpolation (bug #123832)', () => {
  describe('cold load — panel never activated, no query has run', () => {
    it('interpolates ${__interval} against the current dashboard time range (6h → 30s), not a literal', () => {
      const { panel } = buildScene({ from: 'now-6h', to: 'now', maxDataPoints: 500 });

      const [link] = getPanelLinks(panel);

      // The literal ${__interval} would URL-encode to %24%7B__interval%7D — that's the bug shape.
      expect(link.href).not.toMatch(/%24%7B__interval%7D/);
      expect(link.href).not.toMatch(/%24%7B__interval_ms%7D/);
      // 6h / 500 = 43.2s → rounds to 30000ms / 30s
      expect(link.href).toContain('interval=30s');
      expect(link.href).toContain('intervalMs=30000');
    });

    it('interpolates ${__interval} for a tighter range (1h → 5s) without activation', () => {
      const { panel } = buildScene({ from: 'now-1h', to: 'now', maxDataPoints: 500 });

      const [link] = getPanelLinks(panel);

      // 1h / 500 = 7.2s → rounds to 5000ms / 5s
      expect(link.href).toContain('interval=5s');
      expect(link.href).toContain('intervalMs=5000');
    });

    it('respects minInterval when nothing has been measured yet (5m range floored to 1m)', () => {
      const { panel } = buildScene({
        from: 'now-5m',
        to: 'now',
        maxDataPoints: 500,
        minInterval: '1m',
      });

      const [link] = getPanelLinks(panel);

      // 5m / 500 = 600ms → 500ms by roundInterval, but minInterval=1m floors it to 60_000ms / 1m
      expect(link.href).toContain('interval=1m');
      expect(link.href).toContain('intervalMs=60000');
    });

    it('larger maxDataPoints shrinks the interval even before any query runs', () => {
      const { panel } = buildScene({ from: 'now-6h', to: 'now', maxDataPoints: 10000 });

      const [link] = getPanelLinks(panel);

      // 6h / 10000 = 2.16s → rounds to 2000ms / 2s
      expect(link.href).toContain('interval=2s');
      expect(link.href).toContain('intervalMs=2000');
    });
  });

  describe('after a time-range change with no panel re-activation', () => {
    it('reflects the new time range in ${__interval}, not the prior cached value', () => {
      // Start with a 6h range whose interval baked in at 30s.
      const { panel, queryRunner, scene } = buildScene({ from: 'now-6h', to: 'now', maxDataPoints: 500 });
      setStaleRequestInterval(queryRunner, 30_000);

      // Sanity: stale shape is exactly what the bug reads from.
      expect(queryRunner.state.data?.request?.interval).toBe('30s');

      // User changes the dashboard time range to 1h — interval *should* now be 5s.
      scene.state.$timeRange!.setState({ from: 'now-1h', to: 'now' });

      const [link] = getPanelLinks(panel);

      expect(link.href).toContain('interval=5s');
      expect(link.href).toContain('intervalMs=5000');
      // Must not carry the previous 30s/30000 value.
      expect(link.href).not.toMatch(/interval=30s/);
      expect(link.href).not.toMatch(/intervalMs=30000/);
    });

    it('reflects the new time range even after multiple consecutive range changes (latest wins)', () => {
      // Start at 6h whose stale cached interval is 30s. The final range will be 24h whose
      // correct interval (2m) is distinct from 30s, so a passing assertion can only happen
      // if the macro is reading from the live time range, not the cached request.
      const { panel, queryRunner, scene } = buildScene({ from: 'now-6h', to: 'now', maxDataPoints: 500 });
      setStaleRequestInterval(queryRunner, 30_000);

      // First change: 1h
      scene.state.$timeRange!.setState({ from: 'now-1h', to: 'now' });
      // Then a second change before the panel is activated/refreshed: 24h
      scene.state.$timeRange!.setState({ from: 'now-24h', to: 'now' });

      const [link] = getPanelLinks(panel);

      // 24h / 500 = 172.8s → roundInterval → 120_000ms / 2m. Stale was 30s/30000.
      expect(link.href).toContain('interval=2m');
      expect(link.href).toContain('intervalMs=120000');
      expect(link.href).not.toMatch(/interval=30s/);
      expect(link.href).not.toMatch(/intervalMs=30000/);
    });

    it('keeps honoring minInterval after a range change shrinks the natural interval', () => {
      const { panel, queryRunner, scene } = buildScene({
        from: 'now-6h',
        to: 'now',
        maxDataPoints: 500,
        minInterval: '1m',
      });
      setStaleRequestInterval(queryRunner, 60_000);

      // Switch to 5m range — would naturally be tiny, but 1m floor should apply.
      scene.state.$timeRange!.setState({ from: 'now-5m', to: 'now' });

      const [link] = getPanelLinks(panel);

      expect(link.href).toContain('interval=1m');
      expect(link.href).toContain('intervalMs=60000');
    });
  });

  describe('multi-link menu path (panelLinksBehavior)', () => {
    it('panel-link menu activation produces fresh interval-interpolated hrefs on cold load', () => {
      const { panelLinksMenu } = buildScene({
        from: 'now-6h',
        to: 'now',
        maxDataPoints: 500,
        links: [
          { title: 'A', url: 'https://example.com/a?i=${__interval}' },
          { title: 'B', url: 'https://example.com/b?i=${__interval_ms}' },
        ],
      });

      panelLinksMenu.activate();

      const links = panelLinksMenu.state.links ?? [];
      expect(links).toHaveLength(2);
      expect(links[0].href).toContain('i=30s');
      expect(links[0].href).not.toMatch(/%24%7B__interval%7D/);
      expect(links[1].href).toContain('i=30000');
      expect(links[1].href).not.toMatch(/%24%7B__interval_ms%7D/);
    });

    it('panel-link menu activation reflects the latest time range, not stale request data', () => {
      const { panelLinksMenu, queryRunner, scene } = buildScene({
        from: 'now-6h',
        to: 'now',
        maxDataPoints: 500,
        links: [{ title: 'Only', url: 'https://example.com/?i=${__interval}' }],
      });

      setStaleRequestInterval(queryRunner, 30_000);
      scene.state.$timeRange!.setState({ from: 'now-1h', to: 'now' });

      panelLinksMenu.activate();

      const links = panelLinksMenu.state.links ?? [];
      expect(links).toHaveLength(1);
      expect(links[0].href).toContain('i=5s');
      expect(links[0].href).not.toMatch(/i=30s/);
    });
  });
});
