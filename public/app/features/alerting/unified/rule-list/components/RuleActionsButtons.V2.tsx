import { useState } from 'react';

import { LinkButton, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import AlertRuleMenu from 'app/features/alerting/unified/components/rule-viewer/AlertRuleMenu';
import { useDeleteModal } from 'app/features/alerting/unified/components/rule-viewer/DeleteModal';
import { RedirectToCloneRule } from 'app/features/alerting/unified/components/rules/CloneRule';
import SilenceGrafanaRuleDrawer from 'app/features/alerting/unified/components/silences/SilenceGrafanaRuleDrawer';
import { Rule, RuleGroupIdentifierV2, RuleIdentifier } from 'app/types/unified-alerting';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { AlertRuleAction, useRulerRuleAbility } from '../../hooks/useAbilities';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';

interface Props {
  rule: RulerRuleDTO;
  promRule: Rule;
  groupIdentifier: RuleGroupIdentifierV2;
  /**
   * Should we show the buttons in a "compact" state?
   * i.e. without text and using smaller button sizes
   */
  compact?: boolean;
}

// For now this is just a copy of RuleActionsButtons.tsx but with the View button removed.
// This is only done to keep the new list behind a feature flag and limit changes in the existing components
export function RuleActionsButtons({ compact, rule, promRule, groupIdentifier }: Props) {
  const redirectToListView = compact ? false : true;
  const [deleteModal, showDeleteModal] = useDeleteModal(redirectToListView);

  const [showSilenceDrawer, setShowSilenceDrawer] = useState<boolean>(false);

  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const isProvisioned = isGrafanaRulerRule(rule) && Boolean(rule.grafana_alert.provenance);

  const [editRuleSupported, editRuleAllowed] = useRulerRuleAbility(rule, groupIdentifier, AlertRuleAction.Update);

  const canEditRule = editRuleSupported && editRuleAllowed;

  const buttons: JSX.Element[] = [];
  const buttonSize = compact ? 'sm' : 'md';

  const identifier = ruleId.fromRulerRuleAndGroupIdentifierV2(groupIdentifier, rule);

  if (canEditRule) {
    const editURL = createRelativeUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`);

    buttons.push(
      <LinkButton title="Edit" size={buttonSize} key="edit" variant="secondary" icon="pen" href={editURL}>
        <Trans i18nKey="common.edit">Edit</Trans>
      </LinkButton>
    );
  }

  return (
    <Stack gap={1} alignItems="center" wrap="nowrap">
      {buttons}
      <AlertRuleMenu
        buttonSize={buttonSize}
        rulerRule={rule}
        promRule={promRule}
        groupIdentifier={groupIdentifier}
        identifier={identifier}
        handleDelete={() => showDeleteModal(identifier, groupIdentifier)}
        handleSilence={() => setShowSilenceDrawer(true)}
        handleDuplicateRule={() => setRedirectToClone({ identifier, isProvisioned })}
      />
      {deleteModal}
      {isGrafanaAlertingRule(rule) && showSilenceDrawer && (
        <SilenceGrafanaRuleDrawer rulerRule={rule} onClose={() => setShowSilenceDrawer(false)} />
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
