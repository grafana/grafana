import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { RedirectToUrlKey } from './context_srv';
import { clearLoginSectionTitle, getLoginSectionTitle, rememberLoginSectionTitle } from './loginSectionTitle';

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
