import { isString } from 'lodash';
import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import AlertRuleMenu from 'app/features/alerting/unified/components/rule-viewer/AlertRuleMenu';
import { useDeleteModal } from 'app/features/alerting/unified/components/rule-viewer/DeleteModal';
import { INSTANCES_DISPLAY_LIMIT } from 'app/features/alerting/unified/components/rules/RuleDetails';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { useRulesFilter } from 'app/features/alerting/unified/hooks/useFilteredRules';
import { useDispatch } from 'app/types/store';
import { CombinedRule, RuleIdentifier, RulesSource } from 'app/types/unified-alerting';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { fetchPromAndRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName } from '../../utils/datasource';
import { groupIdentifier } from '../../utils/groupIdentifier';
import { createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { getRuleUID, prometheusRuleType, rulerRuleType } from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';

import { RedirectToCloneRule } from './CloneRule';

export const matchesWidth = (width: number) => window.matchMedia(`(max-width: ${width}px)`).matches;

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
  /**
   * Should we show the buttons in a "compact" state?
   * i.e. without text and using smaller button sizes
   */
  compact?: boolean;
  showViewButton?: boolean;
}

/**
 * **Action** buttons to show for an alert rule - e.g. "View", "Edit", "More..."
 */
export const RuleActionsButtons = ({ compact, showViewButton, rule, rulesSource }: Props) => {
  const dispatch = useDispatch();

  const redirectToListView = compact ? false : true;
  const [deleteModal, showDeleteModal] = useDeleteModal(redirectToListView);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState<boolean>(false);

  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const { namespace, group, rulerRule } = rule;
  const { hasActiveFilters } = useRulesFilter();

  const isProvisioned = rulerRuleType.grafana.rule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const [editRuleSupported, editRuleAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Update);

  const canEditRule = editRuleSupported && editRuleAllowed;

  const buttons: JSX.Element[] = [];
  const buttonSize = compact ? 'sm' : 'md';

  const sourceName = getRulesSourceName(rulesSource);

  const identifier = ruleId.fromCombinedRule(sourceName, rule);
  const groupId = groupIdentifier.fromCombinedRule(rule);

  if (showViewButton) {
    buttons.push(
      <LinkButton
        title={t('alerting.rule-actions-buttons.title-view', 'View')}
        size={buttonSize}
        key="view"
        variant="secondary"
        icon="eye"
        href={createViewLink(rulesSource, rule)}
      >
        <Trans i18nKey="common.view">View</Trans>
      </LinkButton>
    );
  }

  if (rulerRule && canEditRule) {
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    const editURL = createRelativeUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`);

    buttons.push(
      <LinkButton
        title={t('alerting.rule-actions-buttons.title-edit', 'Edit')}
        size={buttonSize}
        key="edit"
        variant="secondary"
        icon="pen"
        href={editURL}
      >
        <Trans i18nKey="common.edit">Edit</Trans>
      </LinkButton>
    );
  }

  if (!rule.promRule && !rule.rulerRule) {
    return null;
  }

  // determine if this rule can be silenced by checking for Grafana Alert rule type and extracting the UID
  const ruleUid = getRuleUID(rule.rulerRule ?? rule.promRule);
  const silenceableRule =
    isString(ruleUid) &&
    (rulerRuleType.grafana.alertingRule(rule.rulerRule) || prometheusRuleType.grafana.alertingRule(rule.promRule));

  return (
    <Stack gap={1} alignItems="center" wrap="nowrap">
      {buttons}
      <AlertRuleMenu
        rulerRule={rule.rulerRule}
        promRule={rule.promRule}
        identifier={identifier}
        groupIdentifier={groupId}
        handleDelete={() => {
          if (rule.rulerRule) {
            const editableRuleIdentifier = ruleId.fromRulerRuleAndGroupIdentifierV2(groupId, rule.rulerRule);
            showDeleteModal(editableRuleIdentifier, groupId);
          }
        }}
        handleSilence={() => setShowSilenceDrawer(true)}
        handleDuplicateRule={() => setRedirectToClone({ identifier, isProvisioned })}
        onPauseChange={() => {
          // Uses INSTANCES_DISPLAY_LIMIT + 1 here as exporting LIMIT_ALERTS from RuleList has the side effect
          // of breaking some unrelated tests in Policy.test.tsx due to mocking approach
          const limitAlerts = hasActiveFilters ? undefined : INSTANCES_DISPLAY_LIMIT + 1;
          // Trigger a re-fetch of the rules table
          // TODO: Migrate rules table functionality to RTK Query, so we instead rely
          // on tag invalidation (or optimistic cache updates) for this
          dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME, limitAlerts }));
        }}
        buttonSize={buttonSize}
      />
      {deleteModal}
      {silenceableRule && showSilenceDrawer && (
        <SilenceGrafanaRuleDrawer ruleUid={ruleUid} onClose={() => setShowSilenceDrawer(false)} />
      )}
      {redirectToClone?.identifier && (
        <RedirectToCloneRule
          identifier={redirectToClone.identifier}
          isProvisioned={redirectToClone.isProvisioned}
          onDismiss={() => setRedirectToClone(undefined)}
        />
      )}
    </Stack>
  );
};
