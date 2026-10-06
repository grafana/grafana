import { validateRenderLink } from './links';

describe('validateRenderLink', () => {
  it.each([
    ['#panel-3', { kind: 'view-panel', panelId: 3 }],
    ['  #panel-12  ', { kind: 'view-panel', panelId: 12 }],
    [
      '?viewPanel=panel-3&dtab=overview',
      { kind: 'dashboard-state', params: { viewPanel: 'panel-3', dtab: 'overview' } },
    ],
    ['?from=now-6h&to=now', { kind: 'dashboard-state', params: { from: 'now-6h', to: 'now' } }],
    ['?row-1-dtab=errors', { kind: 'dashboard-state', params: { 'row-1-dtab': 'errors' } }],
    ['/d/abc', { kind: 'dashboard', path: '/d/abc', params: {} }],
    [
      '/d/abc/slug?var-env=prod&var-env=dev',
      { kind: 'dashboard', path: '/d/abc/slug', params: { 'var-env': ['prod', 'dev'] } },
    ],
    [
      '/d/a_B-1?var-host=web%2001&from=2024-01-01T00:00:00Z',
      { kind: 'dashboard', path: '/d/a_B-1', params: { 'var-host': 'web 01', from: '2024-01-01T00:00:00Z' } },
    ],
  ])('accepts %s', (href, expected) => {
    expect(validateRenderLink(href)).toEqual(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,hi',
    '//evil.example/d/abc',
    'https://x',
    '/d/../admin',
    '/d/uid?evil=1',
    '/d/uid#frag',
    '/admin/users',
    '/d/',
    '/d/abc/slug/extra',
    '/d/abc?viewPanel=3',
    '/d/abc?from=now;drop',
    '?viewPanel=panel-3&viewPanel=panel-4',
    '?dtab=over view',
    '?',
    '#top',
    '#panel-x',
    '/d/abc\\evil',
    '/d/ab\nc',
    '/d/abc?var-x=a\u0000',
    '\u0001#panel-3',
    `/d/abc?var-x=${'a'.repeat(513)}`,
    `/d/${'a'.repeat(41)}`,
    `?from=${'1'.repeat(2048)}`,
    '',
  ])('rejects %j', (href) => {
    expect(validateRenderLink(href)).toBeNull();
  });
});
