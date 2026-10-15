import { createAbsoluteUrl, createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { type RuleKind } from '../shared/analytics';

export function ruleShareUrl(uid: string): string {
  return createAbsoluteUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`);
}

export function ruleEditUrl(uid: string): string {
  return createRelativeUrl(`/alerting/${encodeURIComponent(uid)}/edit`);
}

export function ruleDuplicateUrl(kind: RuleKind, uid: string): string {
  const path = kind === 'alert' ? '/alerting/new' : '/alerting/new/grafana-recording';
  return createRelativeUrl(path, { copyFrom: uid });
}
