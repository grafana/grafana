import { createAbsoluteUrl, createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { type RuleKind } from '../shared/analytics';

/**
 * UID-only navigation for the GMA-only rule lists. Every link is built from just a rule UID -
 * never a legacy rule/group identifier - because the new rows and menus only ever load a UID
 * plus the full Kubernetes resource. None carries `returnTo`: the browser's history goes back.
 */

/** Absolute, subpath-aware canonical rule-detail URL with no `returnTo` or list filters - for Copy link. */
export function ruleShareUrl(uid: string): string {
  return createAbsoluteUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`);
}

/** The rule-editor route for a UID-only (ungrouped) Grafana rule. */
export function ruleEditUrl(uid: string): string {
  return createRelativeUrl(`/alerting/${encodeURIComponent(uid)}/edit`);
}

/** Opens the existing creation flow prefilled from the source rule; the editor does its own
 * identity/status/provenance stripping when duplicating from `copyFrom`. */
export function ruleDuplicateUrl(kind: RuleKind, uid: string): string {
  const path = kind === 'alert' ? '/alerting/new' : '/alerting/new/grafana-recording';
  return createRelativeUrl(path, { copyFrom: uid });
}
