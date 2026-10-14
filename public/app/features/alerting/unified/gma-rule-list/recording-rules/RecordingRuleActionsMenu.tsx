import { useState } from 'react';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { type ComponentSize, Dropdown, Menu } from '@grafana/ui';

import { AnalyzeK8sRuleButton } from '../../components/assistant/AnalyzeK8sRuleButton';
import { DeleteRuleConfirmModal } from '../rule-actions/DeleteRuleConfirmModal';
import { DuplicateRuleMenuItem } from '../rule-actions/DuplicateRuleAction';
import { RuleActionMenuItem } from '../rule-actions/RuleActionMenuItem';
import { copyRuleLink } from '../rule-actions/copyRuleLink';
import { ruleShareUrl } from '../rule-actions/ruleLinks';
import { useDeleteRecordingRule } from '../rule-actions/useDeleteRule';
import { useRecordingRulePauseResume } from '../rule-actions/usePauseResumeRule';
import { useRuleActionAbilities } from '../rule-actions/useRuleActionAbilities';
import { type RuleResourceState } from '../rule-data/ruleResourceState';
import { MoreButton } from '../shared/MoreButton';

interface RecordingRuleActionsMenuProps {
  ruleUid: string;
  resourceState: RuleResourceState<RecordingRule>;
  buttonSize?: ComponentSize;
}

/**
 * Action menu for a single Grafana-managed Recording rule row. No Silence, Analyze-with-state,
 * Declare incident, or enrichment items - Recording rules have no alert state, instances, or
 * notification routing to attach any of those to.
 */
export function RecordingRuleActionsMenu({ ruleUid, resourceState, buttonSize }: RecordingRuleActionsMenuProps) {
  const abilities = useRuleActionAbilities(resourceState);
  const { setPaused, isPending: pausePending } = useRecordingRulePauseResume(ruleUid);
  const { deleteRule, isPending: deletePending } = useDeleteRecordingRule(ruleUid);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const rule = resourceState.status === 'loaded' ? resourceState.rule : undefined;
  const ruleTitle = rule?.spec.title ?? ruleUid;
  const isPaused = Boolean(rule?.spec.paused);

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
      {rule && <AnalyzeK8sRuleButton kind="recording" rule={rule} />}
      <DuplicateRuleMenuItem kind="recording" uid={ruleUid} availability={abilities.duplicate} />
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.gma-rule-list.actions.copy-link', 'Copy link')}
        icon="share-alt"
        onClick={() => copyRuleLink('recording', ruleShareUrl(ruleUid))}
      />
      <Menu.Divider />
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
        <MoreButton fill="text" size={buttonSize} />
      </Dropdown>
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
