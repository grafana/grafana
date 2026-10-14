import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/app_events';

import { type RuleKind } from '../shared/analytics';

import { trackRuleCopyLink } from './analytics';

/** Copies a rule's share URL, reporting both success and failure (the clipboard write can reject). */
export function copyRuleLink(kind: RuleKind, url: string) {
  navigator.clipboard
    ?.writeText(url)
    .then(() => {
      trackRuleCopyLink(kind, 'success');
      appEvents.emit(AppEvents.alertSuccess.name, [
        t('alerting.gma-rule-list.actions.copy-link-success', 'URL copied to clipboard'),
      ]);
    })
    .catch(() => {
      trackRuleCopyLink(kind, 'error');
      appEvents.emit(AppEvents.alertError.name, [
        t('alerting.gma-rule-list.actions.copy-link-error', 'Could not copy URL to clipboard'),
      ]);
    });
}
