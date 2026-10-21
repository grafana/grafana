import { config } from '@grafana/runtime';

import { grafanaRulesNav } from './navigation';

describe('grafanaRulesNav', () => {
  const { appUrl, appSubUrl } = config;

  afterEach(() => {
    config.appUrl = appUrl;
    config.appSubUrl = appSubUrl;
  });

  it('builds the view link from the rule UID', () => {
    expect(grafanaRulesNav.viewLink('rule-uid-1')).toBe('/alerting/grafana/rule-uid-1/view');
  });

  it('builds an absolute, subpath-aware share link containing only the rule UID and no returnTo', () => {
    config.appUrl = 'http://localhost:3000/';
    config.appSubUrl = '/grafana';

    expect(grafanaRulesNav.shareLink('rule-uid-1')).toBe(
      'http://localhost:3000/grafana/alerting/grafana/rule-uid-1/view'
    );
  });

  it('builds the UID-only edit link used by the ungrouped rule editor route', () => {
    expect(grafanaRulesNav.editLink('rule-uid-1')).toBe('/alerting/rule-uid-1/edit');
  });

  it.each([
    { recording: false, uid: 'rule-uid-1', url: '/alerting/new?copyFrom=rule-uid-1' },
    { recording: true, uid: 'rule-uid-2', url: '/alerting/new/grafana-recording?copyFrom=rule-uid-2' },
  ])(
    'builds the duplicate link through its new-rule route with copyFrom (recording: $recording)',
    ({ recording, uid, url }) => {
      expect(grafanaRulesNav.duplicateLink(uid, { recording })).toBe(url);
    }
  );

  it.each([
    { name: 'new alert rule', link: grafanaRulesNav.newAlertRuleLink, url: '/alerting/new/alerting' },
    { name: 'new recording rule', link: grafanaRulesNav.newRecordingRuleLink, url: '/alerting/new/grafana-recording' },
    { name: 'design rule for provisioning', link: grafanaRulesNav.exportNewRuleLink, url: '/alerting/export-new-rule' },
  ])('builds the $name link without returnTo', ({ link, url }) => {
    expect(link()).toBe(url);
  });
});
