import { type ReactNode, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, Menu } from '@grafana/ui';

import { type RuleKind } from '../shared/analytics';

import { trackRuleDuplicateStarted } from './analytics';
import { ruleDuplicateUrl } from './ruleLinks';

interface DuplicateRuleActionProps {
  kind: RuleKind;
  uid: string;
  isProvisioned: boolean;
}

interface DuplicateRuleAction {
  menuItem: ReactNode;
  confirmModal: ReactNode;
}

/**
 * Duplicate menu item, shared by the Alert and Recording menus. Opens the existing creation flow
 * prefilled from the source rule (`copyFrom`); the editor itself strips identity, status, and
 * provisioning ownership when it loads a rule that way, so this hook only decides *whether* to
 * navigate and, for a provisioned source, warns first - without ever mentioning evaluation
 * groups, which don't exist in the new rule API.
 *
 * Returns the menu item and the confirmation modal separately: the modal must be rendered by the
 * caller *outside* the Dropdown's `overlay`, not alongside the menu item inside it. @grafana/ui's
 * Dropdown unmounts its whole overlay - via a click handler on the overlay that reacts to any
 * bubbled click, including the one on this very menu item - as soon as it closes, which destroys
 * any state (and any modal) that lives inside it before the modal ever gets a chance to render.
 */
export function useDuplicateRuleAction({ kind, uid, isProvisioned }: DuplicateRuleActionProps): DuplicateRuleAction {
  const [showConfirm, setShowConfirm] = useState(false);

  const duplicate = () => {
    trackRuleDuplicateStarted(kind);
    locationService.push(ruleDuplicateUrl(kind, uid));
  };

  const menuItem = (
    <Menu.Item
      label={t('alerting.gma-rule-list.actions.duplicate', 'Duplicate')}
      icon="copy"
      onClick={() => (isProvisioned ? setShowConfirm(true) : duplicate())}
    />
  );

  const confirmModal = isProvisioned && (
    <ConfirmModal
      isOpen={showConfirm}
      title={t('alerting.gma-rule-list.actions.duplicate-provisioned-title', 'Copy provisioned rule')}
      body={
        <Trans i18nKey="alerting.gma-rule-list.actions.duplicate-provisioned-body">
          The new rule will <strong>not</strong> be marked as provisioned - it will be managed in the UI like any other
          rule.
        </Trans>
      }
      confirmText={t('alerting.gma-rule-list.actions.duplicate-provisioned-confirm', 'Copy')}
      onConfirm={() => {
        setShowConfirm(false);
        duplicate();
      }}
      onDismiss={() => setShowConfirm(false)}
    />
  );

  return { menuItem, confirmModal };
}
