import { config } from '@grafana/runtime';

import { ruleDuplicateUrl, ruleEditUrl, ruleShareUrl, ruleViewUrl } from './ruleLinks';

describe('ruleLinks', () => {
  it('ALERT-6: builds the canonical view URL from only the rule UID, preserving returnTo', () => {
    const url = ruleViewUrl('rule-uid-1');

    expect(url).toContain('/alerting/grafana/rule-uid-1/view');
    expect(url).toContain('returnTo=');
  });

  it('ALERT-6: builds an absolute, subpath-aware share URL containing only the rule UID and no returnTo', () => {
    config.appUrl = 'http://localhost:3000/';
    config.appSubUrl = '/grafana';

    const url = ruleShareUrl('rule-uid-1');

    expect(url).toBe('http://localhost:3000/grafana/alerting/grafana/rule-uid-1/view');
  });

  it('builds the UID-only edit URL used by the ungrouped rule editor route', () => {
    const url = ruleEditUrl('rule-uid-1');

    expect(url).toContain('/alerting/rule-uid-1/edit');
  });

  it('ALERT-6/REC-5: builds the duplicate URL for an alert rule via the new-rule route with copyFrom', () => {
    const url = ruleDuplicateUrl('alert', 'rule-uid-1');

    expect(url).toContain('/alerting/new?');
    expect(url).toContain('copyFrom=rule-uid-1');
  });

  it('REC-5: builds the duplicate URL for a recording rule via the recording-specific new-rule route', () => {
    const url = ruleDuplicateUrl('recording', 'rule-uid-2');

    expect(url).toContain('/alerting/new/grafana-recording?');
    expect(url).toContain('copyFrom=rule-uid-2');
  });
});
