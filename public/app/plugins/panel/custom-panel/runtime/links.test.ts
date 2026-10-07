import { describeRefusedLinks, validateRenderLink } from './links';

describe('describeRefusedLinks', () => {
  it('is undefined when Grafana follows every link', () => {
    expect(describeRefusedLinks([])).toBeUndefined();
    expect(describeRefusedLinks(['#panel-3', '?var-env=prod', '/d/abc'])).toBeUndefined();
  });

  it('names each refused link once and says which links Grafana follows', () => {
    const text = describeRefusedLinks(['https://example.com', '#panel-3', 'https://example.com', '?foo=bar']);
    expect(text).toMatch(
      /^Grafana will not follow these links: "https:\/\/example\.com", "\?foo=bar"\. It follows only #panel-<id>/
    );
  });

  it('names at most five links, each cut to a readable length', () => {
    const long = `https://example.com/${'x'.repeat(200)}`;
    const text = describeRefusedLinks([long, ...['a', 'b', 'c', 'd', 'e', 'f'].map((path) => `/${path}`)]) ?? '';
    expect(text).toContain('and 2 more.');
    expect(text).not.toContain(long);
    expect(text).toContain('…"');
  });
});

describe('validateRenderLink', () => {
  it.each([
    ['#panel-3', { kind: 'view-panel', panelId: 3 }],
    ['  #panel-12  ', { kind: 'view-panel', panelId: 12 }],
    ['#explore-panel-3', { kind: 'explore-panel', panelId: 3 }],
    ['#focus-panel-7', { kind: 'focus-panel', panelId: 7 }],
    ['?editPanel=panel-3', { kind: 'dashboard-state', params: { editPanel: 'panel-3' } }],
    [
      '?editPanel=panel-3&dtab=overview&var-env=prod&from=now-1h',
      {
        kind: 'dashboard-state',
        params: { editPanel: 'panel-3', dtab: 'overview', 'var-env': 'prod', from: 'now-1h' },
      },
    ],
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
    '#explore-panel-',
    '#explore-panel-3x',
    '#explore-panel-1234567890',
    '#explore-panel-3?from=now-1h',
    '#explore-3',
    '#focus-panel-x',
    '#focus-panel--1',
    '#focus-panel-3#panel-4',
    '?editPanel=3',
    '?editPanel=panel-x',
    '?editPanel=panel-3&editPanel=panel-4',
    '?editPanel=panel-3&viewPanel=panel-3',
    '?editPanel=panel-3&evil=1',
    '/d/abc?editPanel=panel-3',
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
