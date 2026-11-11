import { type GrafanaConfig, locationUtil, type NavModelItem } from '@grafana/data';

import { classifyPage } from './classifyPage';
import { hasNothingToResume } from './hasNothingToResume';

const navTree: NavModelItem[] = [
  { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
  {
    text: 'IRM',
    url: '/a/grafana-irm-app',
    children: [
      { text: 'Incidents', url: '/a/grafana-irm-app/incidents' },
      // A menu link that opens a page in a given state.
      { text: 'Usage', url: '/a/grafana-irm-app/settings/usage?tab=daily&orgId=1' },
    ],
  },
  { text: 'Pages', url: '/a/grafana-assistant-app/pages' },
  { text: 'Starred', children: [{ text: 'Service overview', url: '/d/abc/service-overview' }] },
  { text: 'Docs', url: 'https://grafana.com/docs/' },
];

/** The policy for a URL given as `pathname[?search]`, with the default nav tree unless the test is about one. */
const nothingToResume = (url: string, tree = navTree) => {
  const [pathname, search = ''] = url.split(/(?=\?)/);
  const page = classifyPage(pathname, search);
  if (!page) {
    throw new Error(`${url} is not a page`);
  }
  return hasNothingToResume(page, search, tree);
};

describe('hasNothingToResume', () => {
  it.each([
    '/alerting',
    '/alerting/list',
    '/alerting/list?orgId=1',
    '/alerting/list?search=',
    '/a/grafana-irm-app/incidents',
    // The menu link's own state, however the params are ordered or padded.
    '/a/grafana-irm-app/settings/usage?tab=daily',
    '/a/grafana-irm-app/settings/usage?orgId=2&tab=daily',
    '/a/grafana-irm-app/settings/usage?tab=daily&returnTo=%2F&search=',
  ])('%s: the menu opens it the same way', (url) => {
    expect(nothingToResume(url)).toBe(true);
  });

  it.each([
    '/alerting/new',
    '/a/grafana-irm-app/incidents/new?orgId=1',
    '/alerting/new/alerting',
    '/alerting/new/recording?returnTo=%2Falerting%2Flist',
  ])('%s: a create form reopens blank', (url) => {
    expect(nothingToResume(url, [])).toBe(true);
  });

  it.each([
    '/alerting/list?search=firing',
    '/alerting/list?orgId=1&view=grouped',
    '/a/grafana-irm-app/incidents?status=active',
    // Another state of a page the menu links to in one state.
    '/a/grafana-irm-app/settings/usage?tab=weekly',
    '/a/grafana-irm-app/settings/usage',
    // Pages the menu does not link to.
    '/alerting/grafana/abc/view',
    '/a/grafana-irm-app/incidents/5987',
    // Prefilled from a panel: the URL carries what the form will show.
    '/alerting/new/alerting?defaults=%7B%7D',
    // An id that happens to be "new" is not a create form.
    '/alerting/grafana/new/view',
  ])('%s: state in the URL, or a page the menu does not link to', (url) => {
    expect(nothingToResume(url)).toBe(false);
  });

  it('exempts dashboards: the starred section lists them', () => {
    expect(nothingToResume('/d/abc/service-overview')).toBe(false);
    expect(nothingToResume('/d/abc')).toBe(false);
  });

  it('matches nav urls that carry the app sub url', () => {
    const subUrl = (appSubUrl: string) =>
      locationUtil.initialize({
        config: { appSubUrl } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
    subUrl('/grafana');
    try {
      const prefixed: NavModelItem[] = [{ text: 'Alert rules', url: '/grafana/alerting/list' }];
      expect(nothingToResume('/alerting/list', prefixed)).toBe(true);
      expect(nothingToResume('/alerting/list?search=firing', prefixed)).toBe(false);
    } finally {
      subUrl('');
    }
  });
});
