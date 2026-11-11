import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { contextSrv, RedirectToUrlKey } from './context_srv';
import {
  clearLoginSectionTitle,
  getLoginSectionTitle,
  rememberLoginDashboardTitle,
  rememberLoginSectionTitle,
} from './loginSectionTitle';

const originalSubUrl = config.appSubUrl;

beforeEach(() => {
  sessionStorage.clear();
  config.appSubUrl = '/grafana';
  setTestFlags({ [FlagKeys.GrafanaPreserveLoginTabTitle]: true });
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  config.appSubUrl = originalSubUrl;
  setTestFlags({});
});

it.each([
  ['dashboards/browse', '/d/abc/secret-title', 'Dashboards'],
  ['explore', '/explore', 'Explore'],
  ['datasources', '/connections/datasources/edit/abc', 'Data sources'],
  ['alert-rules', '/alerting/abc/edit', 'Alert rules'],
])('retains only the generic label for %s', (id, pathname, title) => {
  rememberLoginSectionTitle({ id, text: 'Sensitive name' }, pathname);
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(`/grafana${pathname}?orgId=2`));
  expect(getLoginSectionTitle()).toBe(title);
  expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Sensitive name');
});

it.each(['/grafana', '/grafana/', '/grafana?orgId=2', '/'])(
  'preserves the Home section for redirect %s',
  (redirect) => {
    rememberLoginSectionTitle({ id: 'home', text: 'Home' }, '/');
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(redirect));
    expect(getLoginSectionTitle()).toBe('Home');
  }
);

it('uses the nearest catalogue ancestor of a specific navigation item', () => {
  rememberLoginSectionTitle(
    { id: 'user-123', text: 'Sensitive username', parentItem: { id: 'global-users', text: 'Users' } },
    '/admin/users/edit/123'
  );
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/admin/users/edit/123'));
  expect(getLoginSectionTitle()).toBe('Users');
});

it.each(['/explore', '/d/other/test', 'https://other.example/d/abc/test', '/other-instance/d/abc/test', '%invalid'])(
  'falls back for an unrelated or invalid destination %s',
  (redirect) => {
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, '/d/abc/test');
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(redirect));
    expect(getLoginSectionTitle()).toBeUndefined();
  }
);

it('does not label a direct login visit', () => {
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  expect(getLoginSectionTitle()).toBeUndefined();
});

it('clears the label for unknown navigation and explicit sign-out', () => {
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/explore'));
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  expect(getLoginSectionTitle()).toBe('Explore');
  rememberLoginSectionTitle({ id: 'custom-app', text: 'Sensitive name' }, '/explore');
  expect(getLoginSectionTitle()).toBeUndefined();
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  clearLoginSectionTitle();
  expect(getLoginSectionTitle()).toBeUndefined();
});

it('does not use another Grafana instance on the same origin', () => {
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/explore'));
  config.appSubUrl = '/another';
  expect(getLoginSectionTitle()).toBeUndefined();
});

it('falls back when saved storage is malformed', () => {
  sessionStorage.setItem('grafana.loginSection', '{');
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/explore'));
  expect(getLoginSectionTitle()).toBeUndefined();
});

it('falls back when browser storage is unavailable', () => {
  jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
    throw new DOMException('Storage disabled', 'SecurityError');
  });
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  clearLoginSectionTitle();
  expect(getLoginSectionTitle()).toBeUndefined();
});

it('falls back when login tab title preservation is disabled', () => {
  rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
  sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/explore'));
  setTestFlags({ [FlagKeys.GrafanaPreserveLoginTabTitle]: false });
  expect(getLoginSectionTitle()).toBeUndefined();
});

describe('dashboard names', () => {
  const originalSignedIn = contextSrv.user.isSignedIn;
  const originalOrgId = contextSrv.user.orgId;
  const pathname = '/d/abc/api-latency';

  beforeEach(() => {
    contextSrv.user.isSignedIn = true;
    contextSrv.user.orgId = 1;
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: true,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
    });
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, pathname);
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(`/grafana${pathname}?orgId=1`));
  });

  afterEach(() => {
    contextSrv.user.isSignedIn = originalSignedIn;
    contextSrv.user.orgId = originalOrgId;
  });

  it('uses the actual dashboard name and updates it after a rename', () => {
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    expect(getLoginSectionTitle()).toBe('Mimir / Writes');
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, pathname);
    expect(getLoginSectionTitle()).toBe('Mimir / Writes');
    rememberLoginDashboardTitle('Mimir / Renamed', pathname);
    expect(getLoginSectionTitle()).toBe('Mimir / Renamed');
  });

  it.each([
    [false, true],
    [true, false],
  ])('does not store names with section flag %s and dashboard flag %s', (section, dashboard) => {
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: section,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: dashboard,
    });
    rememberLoginDashboardTitle('Sensitive name', pathname);
    expect(JSON.parse(sessionStorage.getItem('grafana.loginSection')!)).toEqual({
      navId: 'dashboards/browse',
      pathname,
      appSubUrl: '/grafana',
    });
  });

  it('does not capture names while signed out', () => {
    contextSrv.user.isSignedIn = false;
    rememberLoginDashboardTitle('Sensitive name', pathname);
    expect(getLoginSectionTitle()).toBe('Dashboards');
    expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Sensitive name');
  });

  it('falls back to the generic label when dashboard retention is disabled', () => {
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    setTestFlags({ [FlagKeys.GrafanaPreserveLoginTabTitle]: true });
    expect(getLoginSectionTitle()).toBe('Dashboards');
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, pathname);
    expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Mimir / Writes');
  });

  it('discards the dashboard name when navigating to another section', () => {
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    rememberLoginSectionTitle({ id: 'explore', text: 'Explore' }, '/explore');
    rememberLoginDashboardTitle('Wrong section name', '/explore');
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/grafana/explore'));
    expect(getLoginSectionTitle()).toBe('Explore');
    expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Mimir / Writes');
  });

  it('does not associate a name with another dashboard path', () => {
    rememberLoginDashboardTitle('Wrong dashboard', '/d/other/title');
    expect(getLoginSectionTitle()).toBe('Dashboards');
    expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Wrong dashboard');
  });

  it('does not reuse a dashboard name for another organization', () => {
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent(`/grafana${pathname}?orgId=2`));
    expect(getLoginSectionTitle()).toBe('Dashboards');
    contextSrv.user.orgId = 2;
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, pathname);
    expect(sessionStorage.getItem('grafana.loginSection')).not.toContain('Mimir / Writes');
  });

  it('clears a remembered name with the existing section cleanup', () => {
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    clearLoginSectionTitle();
    expect(sessionStorage.getItem('grafana.loginSection')).toBeNull();
  });

  it('replaces malformed metadata during navigation', () => {
    sessionStorage.setItem('grafana.loginSection', '{');
    rememberLoginSectionTitle({ id: 'dashboards/browse', text: 'Dashboards' }, pathname);
    rememberLoginDashboardTitle('Mimir / Writes', pathname);
    expect(getLoginSectionTitle()).toBe('Mimir / Writes');
  });
});
