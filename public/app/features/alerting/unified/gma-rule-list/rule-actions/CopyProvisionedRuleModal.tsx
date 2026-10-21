import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';

import { type RuleKind } from '../shared/ruleKind';

import { trackRuleDuplicateStarted } from './analytics';
import { ruleDuplicateUrl } from './ruleLinks';

interface CopyProvisionedRuleModalProps {
  kind: RuleKind;
  uid: string;
  isOpen: boolean;
  onDismiss: () => void;
}

/** Rendered beside the dropdown, which unmounts its overlay on any click and would take the modal with it. */
export function CopyProvisionedRuleModal({ kind, uid, isOpen, onDismiss }: CopyProvisionedRuleModalProps) {
  const title =
    kind === 'alert'
      ? t('alerting.gma-rule-list.actions.copy-provisioned-alert-title', 'Copy provisioned alert rule')
      : t('alerting.gma-rule-list.actions.copy-provisioned-recording-title', 'Copy provisioned recording rule');

  const copy = () => {
    onDismiss();
    trackRuleDuplicateStarted(kind);
    // History is mounted at the sub path; strip what the link builder adds.
    locationService.push(locationUtil.stripBaseFromUrl(ruleDuplicateUrl(kind, uid)));
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      body={
        <div>
          <p>
            <Trans i18nKey="alerting.gma-rule-list.actions.copy-provisioned-not-provisioned">
              The new rule will <strong>not</strong> be marked as a provisioned rule.
            </Trans>
          </p>
          <p>
            <Trans i18nKey="alerting.gma-rule-list.actions.copy-provisioned-evaluation-group">
              You will need to set a new evaluation group for the copied rule because the original one has been
              provisioned and cannot be used for rules created in the UI.
            </Trans>
          </p>
        </div>
      }
      confirmText={t('alerting.gma-rule-list.actions.copy-provisioned-confirm', 'Copy')}
      onConfirm={copy}
      onDismiss={onDismiss}
    />
  );
}
