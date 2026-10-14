import { createReturnTo } from 'app/features/alerting/unified/hooks/useReturnTo';
import { createAbsoluteUrl, createRelativeUrl } from 'app/features/alerting/unified/utils/url';

/**
 * UID-only navigation for the GMA-only rule lists. Every link is built from just a rule UID -
 * never a legacy rule/group identifier - because the new rows and menus only ever load a UID
 * plus the full Kubernetes resource.
 */

/** The canonical rule-detail route, preserving the current page as `returnTo`. */
export function ruleViewUrl(uid: string): string {
  return createRelativeUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`, { returnTo: createReturnTo() });
}

/** Absolute, subpath-aware canonical rule-detail URL with no `returnTo` or list filters - for Copy link. */
export function ruleShareUrl(uid: string): string {
  return createAbsoluteUrl(`/alerting/grafana/${encodeURIComponent(uid)}/view`);
}

/** The rule-editor route for a UID-only (ungrouped) Grafana rule. */
export function ruleEditUrl(uid: string): string {
  return createRelativeUrl(`/alerting/${encodeURIComponent(uid)}/edit`, { returnTo: createReturnTo() });
}

/** Opens the existing creation flow prefilled from the source rule; the editor does its own
 * identity/status/provenance stripping when duplicating from `copyFrom`. */
export function ruleDuplicateUrl(kind: 'alert' | 'recording', uid: string): string {
  const path = kind === 'alert' ? '/alerting/new' : '/alerting/new/grafana-recording';
  return createRelativeUrl(path, { copyFrom: uid, returnTo: createReturnTo() });
}
