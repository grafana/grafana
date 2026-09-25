import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, Menu } from '@grafana/ui';

import { type RuleKind, trackRuleDuplicateStarted } from './analytics';
import { ruleDuplicateUrl } from './ruleLinks';

interface DuplicateRuleActionProps {
  kind: RuleKind;
  uid: string;
  isProvisioned: boolean;
}

/**
 * Duplicate menu item, shared by the Alert and Recording menus. Opens the existing creation flow
 * prefilled from the source rule (`copyFrom`); the editor itself strips identity, status, and
 * provisioning ownership when it loads a rule that way, so this component only decides *whether*
 * to navigate and, for a provisioned source, warns first - without ever mentioning evaluation
 * groups, which don't exist in the new rule API.
 */
export function DuplicateRuleAction({ kind, uid, isProvisioned }: DuplicateRuleActionProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const duplicate = () => {
    trackRuleDuplicateStarted(kind);
    locationService.push(ruleDuplicateUrl(kind, uid));
  };

  return (
    <>
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.duplicate', 'Duplicate')}
        icon="copy"
        onClick={() => (isProvisioned ? setShowConfirm(true) : duplicate())}
      />
      {isProvisioned && (
        <ConfirmModal
          isOpen={showConfirm}
          title={t('alerting.gma-rule-list.actions.duplicate-provisioned-title', 'Copy provisioned rule')}
          body={
            <Trans i18nKey="alerting.gma-rule-list.actions.duplicate-provisioned-body">
              The new rule will <strong>not</strong> be marked as provisioned - it will be managed in the UI like any
              other rule.
            </Trans>
          }
          confirmText={t('alerting.gma-rule-list.actions.duplicate-provisioned-confirm', 'Copy')}
          onConfirm={() => {
            setShowConfirm(false);
            duplicate();
          }}
          onDismiss={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
