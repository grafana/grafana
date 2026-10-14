import { useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type ComponentSize, Dropdown, Menu } from '@grafana/ui';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { AnalyzeK8sRuleButton } from '../../components/assistant/AnalyzeK8sRuleButton';
import { EnrichmentDrawerExtension } from '../../components/rule-list/extensions/EnrichmentDrawerExtension';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useEnrichmentAbility } from '../../hooks/abilities/otherAbilities';
import { useCanSilenceInFolder, useGrafanaRulesSilenceSupport } from '../../hooks/abilities/rules/ruleAbilities.utils';
import { EnrichmentAction } from '../../hooks/abilities/types';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { isK8sEntityProvisioned } from '../../utils/k8s/utils';
import { DeleteRuleConfirmModal } from '../rule-actions/DeleteRuleConfirmModal';
import { useDuplicateRuleAction } from '../rule-actions/DuplicateRuleAction';
import { copyRuleLink } from '../rule-actions/copyRuleLink';
import { type OnMutated } from '../rule-actions/ruleActionTypes';
import { ruleShareUrl } from '../rule-actions/ruleLinks';
import { useDeleteAlertRule } from '../rule-actions/useDeleteRule';
import { useAlertRulePauseResume } from '../rule-actions/usePauseResumeRule';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { MoreButton } from '../shared/MoreButton';

interface AlertRuleActionsMenuProps {
  ruleUid: string;
  resourceState: RuleResourceState<AlertRule>;
  onMutated: OnMutated;
  buttonSize?: ComponentSize;
}

/**
 * Action menu for a single Grafana-managed Alert rule row in the GMA-only list. Takes only the
 * rule UID and its full-resource fetch state - never a legacy rule/group identifier.
 */
export function AlertRuleActionsMenu({ ruleUid, resourceState, onMutated, buttonSize }: AlertRuleActionsMenuProps) {
  const abilities = useRuleActionAbilities(resourceState);
  const { setPaused, isPending: pausePending } = useAlertRulePauseResume(ruleUid);
  const { deleteRule, isPending: deletePending } = useDeleteAlertRule(ruleUid);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const rule = resourceState.status === 'loaded' ? resourceState.rule : undefined;
  const ruleTitle = rule?.spec.title ?? ruleUid;
  const folderUid = rule?.metadata.annotations?.[AnnoKeyFolder];
  const isPaused = Boolean(rule?.spec.paused);
  const isProvisioned = rule ? isK8sEntityProvisioned(rule) : false;

  const { silenceSupported } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(folderUid);
  const canSilence = silenceSupported && canSilenceInFolder;

  const canReadEnrichments = isGranted(useEnrichmentAbility(EnrichmentAction.Read));
  // alertingEnrichmentPerRule has no OpenFeature migration yet; this mirrors the same gate
  // AlertRuleMenu.tsx already uses for the legacy list's "Manage enrichments" item.
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const canManageEnrichments = Boolean(config.featureToggles.alertingEnrichmentPerRule) && canReadEnrichments;

  const { menuItem: duplicateMenuItem, confirmModal: duplicateConfirmModal } = useDuplicateRuleAction({
    kind: 'alert',
    uid: ruleUid,
    isProvisioned,
  });

  const menuItems = (
    <>
      {abilities.pause.available && rule && (
        <Menu.Item
          label={
            isPaused
              ? t('alerting.gma-rule-list.actions.resume', 'Resume')
              : t('alerting.gma-rule-list.actions.pause', 'Pause')
          }
          icon={isPaused ? 'play' : 'pause'}
          disabled={pausePending}
          onClick={() => setPaused(!isPaused, onMutated)}
        />
      )}
      {canSilence && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.silence-notifications', 'Silence notifications')}
          icon="bell-slash"
          onClick={() => setShowSilenceDrawer(true)}
        />
      )}
      {rule && <AnalyzeK8sRuleButton kind="alert" rule={rule} />}
      {abilities.duplicate.available && duplicateMenuItem}
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.copy-link', 'Copy link')}
        icon="share-alt"
        onClick={() => copyRuleLink('alert', ruleShareUrl(ruleUid))}
      />
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.gma-rule-list.actions.manage-enrichments', 'Manage enrichments')}
          icon="edit"
          onClick={() => setShowEnrichmentDrawer(true)}
        />
      )}
      {abilities.delete.available && (
        <>
          <Menu.Divider />
          <Menu.Item
            label={t('alerting.common.delete', 'Delete')}
            icon="trash-alt"
            destructive
            onClick={() => setShowDeleteModal(true)}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <Dropdown overlay={<Menu>{menuItems}</Menu>} placement="bottom-end">
        <MoreButton fill="text" size={buttonSize} />
      </Dropdown>
      {showSilenceDrawer && (
        <AlertmanagerProvider accessType="instance">
          <SilenceGrafanaRuleDrawer
            rule={{ uid: ruleUid, title: ruleTitle, folderUid }}
            onClose={() => setShowSilenceDrawer(false)}
          />
        </AlertmanagerProvider>
      )}
      {showEnrichmentDrawer && (
        <EnrichmentDrawerExtension ruleUid={ruleUid} onClose={() => setShowEnrichmentDrawer(false)} />
      )}
      {duplicateConfirmModal}
      <DeleteRuleConfirmModal
        isOpen={showDeleteModal}
        ruleTitle={ruleTitle}
        isDeleting={deletePending}
        onConfirm={() => deleteRule(onMutated)}
        onDismiss={() => setShowDeleteModal(false)}
      />
    </>
  );
}
