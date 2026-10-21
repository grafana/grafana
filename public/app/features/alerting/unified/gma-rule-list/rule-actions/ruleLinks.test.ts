import { config } from '@grafana/runtime';

import { ruleDuplicateUrl, ruleEditUrl, ruleShareUrl } from './ruleLinks';

describe('ruleLinks', () => {
  const { appUrl, appSubUrl } = config;

  afterEach(() => {
    config.appUrl = appUrl;
    config.appSubUrl = appSubUrl;
  });

  it('builds an absolute, subpath-aware share URL containing only the rule UID and no returnTo', () => {
    config.appUrl = 'http://localhost:3000/';
    config.appSubUrl = '/grafana';

    expect(ruleShareUrl('rule-uid-1')).toBe('http://localhost:3000/grafana/alerting/grafana/rule-uid-1/view');
  });

  it('builds the UID-only edit URL used by the ungrouped rule editor route', () => {
    expect(ruleEditUrl('rule-uid-1')).toBe('/alerting/rule-uid-1/edit');
  });

  it.each([
    { kind: 'alert', uid: 'rule-uid-1', url: '/alerting/new?copyFrom=rule-uid-1' },
    { kind: 'recording', uid: 'rule-uid-2', url: '/alerting/new/grafana-recording?copyFrom=rule-uid-2' },
  ] as const)('builds the $kind duplicate URL through its new-rule route with copyFrom', ({ kind, uid, url }) => {
    expect(ruleDuplicateUrl(kind, uid)).toBe(url);
  });
});
