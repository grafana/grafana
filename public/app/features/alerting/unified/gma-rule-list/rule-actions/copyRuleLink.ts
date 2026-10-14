import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';

import { type RuleKind } from '../shared/analytics';

import { trackRuleCopyLink } from './analytics';

/**
 * Copies a rule's share URL, reporting both success and failure. The clipboard API is missing in
 * insecure contexts and its write can reject, and both must reach the user as the failure toast.
 */
export async function copyRuleLink(kind: RuleKind, url: string) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    trackRuleCopyLink(kind, 'error');
    appEvents.emit(AppEvents.alertError.name, [
      t('alerting.gma-rule-list.actions.copy-link-error', 'Could not copy URL to clipboard'),
    ]);
    return;
  }

  trackRuleCopyLink(kind, 'success');
  appEvents.emit(AppEvents.alertSuccess.name, [
    t('alerting.gma-rule-list.actions.copy-link-success', 'URL copied to clipboard'),
  ]);
}
