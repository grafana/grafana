import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, Menu } from '@grafana/ui';

import { AnalyzeRuleButton } from '../../components/assistant/AnalizeRuleButton';
import { EnrichmentDrawerExtension } from '../../components/rule-list/extensions/EnrichmentDrawerExtension';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useEnrichmentAbility } from '../../hooks/abilities/otherAbilities';
import { EnrichmentAction } from '../../hooks/abilities/types';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { grafanaRulesNav } from '../../utils/navigation';
import { CopyProvisionedRuleModal } from '../rule-actions/CopyProvisionedRuleModal';
import { DeleteRuleConfirmModal } from '../rule-actions/DeleteRuleConfirmModal';
import { DuplicateRuleMenuItem } from '../rule-actions/DuplicateRuleAction';
import { RuleActionMenuItem } from '../rule-actions/RuleActionMenuItem';
import { isActionShown } from '../rule-actions/actionReasons';
import { copyRuleLink } from '../rule-actions/copyRuleLink';
import { useDeleteAlertRule } from '../rule-actions/useDeleteRule';
import { useAlertRulePauseResume } from '../rule-actions/usePauseResumeRule';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { useSilenceAvailability } from '../rule-actions/useSilenceAvailability';
import { isProvisionedOrManaged } from '../rule-data/ruleOwnership';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { MoreButton } from '../shared/MoreButton';

interface AlertRuleActionsMenuProps {
  ruleUid: string;
  resourceState: RuleResourceState<AlertRule>;
}

export function AlertRuleActionsMenu({ ruleUid, resourceState }: AlertRuleActionsMenuProps) {
  const abilities = useRuleActionAbilities(resourceState);
  const { setPaused, isPending: pausePending } = useAlertRulePauseResume(ruleUid);
  const { deleteRule, isPending: deletePending } = useDeleteAlertRule(ruleUid);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  const rule = resourceState.status === 'loaded' ? resourceState.rule : undefined;
  const ruleTitle = rule?.spec.title ?? ruleUid;
  const isPaused = Boolean(rule?.spec.paused);
  const silence = useSilenceAvailability(resourceState);
  const confirmBeforeCopy = rule !== undefined && isProvisionedOrManaged(rule);

  const canReadEnrichments = isGranted(useEnrichmentAbility(EnrichmentAction.Read));
  // No OpenFeature migration yet; mirrors the gate in AlertRuleMenu.tsx.
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const canManageEnrichments = Boolean(config.featureToggles.alertingEnrichmentPerRule) && canReadEnrichments;

  // Mirrors the Analyze item's own gate, so the divider never sits above nothing.
  const assistant = useAssistant();
  const showsAnalyze = rule !== undefined && assistant.isAvailable && Boolean(assistant.openAssistant);
  const hasFirstSection =
    showsAnalyze || isActionShown(abilities.pause) || isActionShown(silence) || isActionShown(abilities.duplicate);
  const showDelete = isActionShown(abilities.delete);

  const menuItems = (
    <>
      <RuleActionMenuItem
        availability={abilities.pause}
        label={
          isPaused
            ? t('alerting.gma-rule-list.actions.resume', 'Resume')
            : t('alerting.gma-rule-list.actions.pause', 'Pause')
        }
        icon={isPaused ? 'play' : 'pause'}
        disabled={pausePending}
        onClick={() => setPaused(!isPaused)}
      />
      <RuleActionMenuItem
        availability={silence}
        label={t('alerting.gma-rule-list.actions.silence-notifications', 'Silence notifications')}
        icon="bell-slash"
        onClick={() => setShowSilenceDrawer(true)}
      />
      {rule && <AnalyzeRuleButton alertRule={rule} />}
      <DuplicateRuleMenuItem
        kind="alert"
        uid={ruleUid}
        availability={abilities.duplicate}
        onConfirmFirst={confirmBeforeCopy ? () => setShowCopyModal(true) : undefined}
      />
      {hasFirstSection && <Menu.Divider />}
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.copy-link', 'Copy link')}
        icon="share-alt"
        onClick={() => copyRuleLink('alert', grafanaRulesNav.shareLink(ruleUid))}
      />
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.manage-enrichments', 'Manage enrichments')}
          icon="edit"
          onClick={() => setShowEnrichmentDrawer(true)}
        />
      )}
      {showDelete && <Menu.Divider />}
      <RuleActionMenuItem
        availability={abilities.delete}
        label={t('alerting.common.delete', 'Delete')}
        icon="trash-alt"
        destructive
        onClick={() => setShowDeleteModal(true)}
      />
    </>
  );

  return (
    <>
      <Dropdown overlay={<Menu>{menuItems}</Menu>} placement="bottom-end">
        <MoreButton fill="text" size="sm" />
      </Dropdown>
      {showSilenceDrawer && (
        <AlertmanagerProvider accessType="instance">
          <SilenceGrafanaRuleDrawer ruleUid={ruleUid} onClose={() => setShowSilenceDrawer(false)} />
        </AlertmanagerProvider>
      )}
      {showEnrichmentDrawer && (
        <EnrichmentDrawerExtension ruleUid={ruleUid} onClose={() => setShowEnrichmentDrawer(false)} />
      )}
      <CopyProvisionedRuleModal
        kind="alert"
        uid={ruleUid}
        isOpen={showCopyModal}
        onDismiss={() => setShowCopyModal(false)}
      />
      <DeleteRuleConfirmModal
        isOpen={showDeleteModal}
        ruleTitle={ruleTitle}
        isDeleting={deletePending}
        onConfirm={() => deleteRule()}
        onDismiss={() => setShowDeleteModal(false)}
      />
    </>
  );
}
