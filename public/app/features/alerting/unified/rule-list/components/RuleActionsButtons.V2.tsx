import { isString } from 'lodash';
import { useState } from 'react';
import { RequireAtLeastOne } from 'type-fest';

import { Trans, t } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import { EnrichmentDrawerExtension } from 'app/features/alerting/unified/components/rule-list/extensions/EnrichmentDrawerExtension';
import AlertRuleMenu from 'app/features/alerting/unified/components/rule-viewer/AlertRuleMenu';
import { useDeleteModal } from 'app/features/alerting/unified/components/rule-viewer/DeleteModal';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import {
  EditableRuleIdentifier,
  GrafanaRuleIdentifier,
  Rule,
  RuleGroupIdentifierV2,
  RuleIdentifier,
} from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { logWarning } from '../../Analytics';
import { AlertRuleAction, skipToken, useGrafanaPromRuleAbility, useRulerRuleAbility } from '../../hooks/useAbilities';
import * as ruleId from '../../utils/rule-id';
import {
  getRuleUID,
  isProvisionedPromRule,
  isProvisionedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';

type RuleProps = RequireAtLeastOne<{
  rule?: RulerRuleDTO;
  promRule?: Rule;
}>;

type Props = RuleProps & {
  groupIdentifier: RuleGroupIdentifierV2;
  /**
   * Should we show the buttons in a "compact" state?
   * i.e. without text and using smaller button sizes
   */
  compact?: boolean;
};

// For now this is just a copy of RuleActionsButtons.tsx but with the View button removed.
// This is only done to keep the new list behind a feature flag and limit changes in the existing components
export function RuleActionsButtons({ compact, rule, promRule, groupIdentifier }: Props) {
  const redirectToListView = compact ? false : true;
  const [deleteModal, showDeleteModal] = useDeleteModal(redirectToListView);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState<boolean>(false);
  const [showEnrichmentDrawer, setShowEnrichmentDrawer] = useState<boolean>(false);

  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const isProvisioned = getIsProvisioned(rule, promRule);

  const [editRuleSupported, editRuleAllowed] = useRulerRuleAbility(rule, groupIdentifier, AlertRuleAction.Update);
  // If the consumer of this component comes from the alert list view, we need to use promRule to check abilities and permissions,
  // as we have removed all requests to the ruler API in the list view.
  const [grafanaEditRuleSupported, grafanaEditRuleAllowed] = useGrafanaPromRuleAbility(
    prometheusRuleType.grafana.rule(promRule) ? promRule : skipToken,
    AlertRuleAction.Update
  );

  const canEditRule = (editRuleSupported && editRuleAllowed) || (grafanaEditRuleSupported && grafanaEditRuleAllowed);

  const buttons: JSX.Element[] = [];
  const buttonSize = compact ? 'sm' : 'md';

  const identifier = getEditableIdentifier(groupIdentifier, rule, promRule);

  if (!identifier) {
    return null;
  }

  // determine if this rule can be silenced by checking for Grafana Alert rule type and extracting the UID
  const ruleUid = getRuleUID(rule ?? promRule);
  const silenceableRule =
    isString(ruleUid) &&
    (rulerRuleType.grafana.alertingRule(rule) || prometheusRuleType.grafana.alertingRule(promRule));

  if (canEditRule) {
    const editURL = createRelativeUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`);

    buttons.push(
      <LinkButton
        title={t('alerting.rule-actions-buttons.title-edit', 'Edit')}
        size={buttonSize}
        key="edit"
        variant="secondary"
        fill="text"
        href={editURL}
      >
        <Trans i18nKey="common.edit">Edit</Trans>
      </LinkButton>
    );
  }

  return (
    <Stack gap={0} alignItems="center" wrap="nowrap">
      {buttons}
      <AlertRuleMenu
        buttonSize={buttonSize}
        fill="text"
        rulerRule={rule}
        promRule={promRule}
        groupIdentifier={groupIdentifier}
        identifier={identifier}
        handleDelete={(identifier, groupIdentifier) => showDeleteModal(identifier, groupIdentifier)}
        handleSilence={() => setShowSilenceDrawer(true)}
        handleManageEnrichments={() => setShowEnrichmentDrawer(true)}
        handleDuplicateRule={() => setRedirectToClone({ identifier, isProvisioned })}
      />
      {deleteModal}
      {silenceableRule && showSilenceDrawer && (
        <SilenceGrafanaRuleDrawer ruleUid={ruleUid} onClose={() => setShowSilenceDrawer(false)} />
      )}
      {ruleUid && showEnrichmentDrawer && (
        <EnrichmentDrawerExtension ruleUid={ruleUid} onClose={() => setShowEnrichmentDrawer(false)} />
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
}

function getIsProvisioned(rule?: RulerRuleDTO, promRule?: Rule): boolean {
  if (rule) {
    return isProvisionedRule(rule);
  }

  if (promRule) {
    return isProvisionedPromRule(promRule);
  }

  return false;
}

function getEditableIdentifier(
  groupIdentifier: RuleGroupIdentifierV2,
  rule?: RulerRuleDTO,
  promRule?: Rule
): EditableRuleIdentifier | undefined {
  if (rule) {
    return ruleId.fromRulerRuleAndGroupIdentifierV2(groupIdentifier, rule);
  }

  if (prometheusRuleType.grafana.rule(promRule)) {
    return {
      ruleSourceName: 'grafana',
      uid: promRule.uid,
    } satisfies GrafanaRuleIdentifier;
  }

  logWarning('Unable to construct an editable rule identifier');

  // Returning undefined is safer than throwing here as it allows the component to gracefully handle
  // the error by returning null instead of crashing the entire component tree
  return undefined;
}
