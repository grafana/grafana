import { Fragment } from 'react';

import { textUtil } from '@grafana/data';
import { useReturnToPrevious } from '@grafana/runtime';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { useStateHistoryModal } from '../../hooks/useStateHistoryModal';
import { Annotation } from '../../utils/constants';
import { isCloudRulesSource } from '../../utils/datasource';
import { createExploreLink } from '../../utils/misc';
import { isFederatedRuleGroup, rulerRuleType } from '../../utils/rules';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

/**
 * Buttons to display on an expanded alert rule in the list view
 *
 * e.g. "Show state history", "Go to dashboard"
 *
 * Shouldn't include *actions* for the alert rule, just navigation items
 */
const RuleDetailsButtons = ({ rule, rulesSource }: Props) => {
  const { group } = rule;
  const { StateHistoryModal, showStateHistoryModal } = useStateHistoryModal();

  const setReturnToPrevious = useReturnToPrevious();

  const [exploreSupported, exploreAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Explore);

  const buttons: JSX.Element[] = [];

  const isFederated = isFederatedRuleGroup(group);

  // explore does not support grafana rule queries atm
  // neither do "federated rules"
  if (isCloudRulesSource(rulesSource) && exploreSupported && exploreAllowed && !isFederated) {
    buttons.push(
      <LinkButton
        size="sm"
        key="explore"
        variant="primary"
        icon="chart-line"
        target="_blank"
        href={createExploreLink(rulesSource, rule.query)}
      >
        See graph
      </LinkButton>
    );
  }
  if (rule.annotations[Annotation.runbookURL]) {
    buttons.push(
      <LinkButton
        size="sm"
        key="runbook"
        variant="primary"
        icon="book"
        target="_blank"
        href={textUtil.sanitizeUrl(rule.annotations[Annotation.runbookURL])}
      >
        View runbook
      </LinkButton>
    );
  }
  if (rule.annotations[Annotation.dashboardUID]) {
    const dashboardUID = rule.annotations[Annotation.dashboardUID];
    if (dashboardUID) {
      buttons.push(
        <LinkButton
          size="sm"
          key="dashboard"
          variant="primary"
          icon="apps"
          href={`d/${encodeURIComponent(dashboardUID)}`}
          onClick={() => {
            setReturnToPrevious(rule.name);
          }}
        >
          Go to dashboard
        </LinkButton>
      );
      const panelId = rule.annotations[Annotation.panelID];
      if (panelId) {
        buttons.push(
          <LinkButton
            size="sm"
            key="panel"
            variant="primary"
            icon="apps"
            href={`d/${encodeURIComponent(dashboardUID)}?viewPanel=${encodeURIComponent(panelId)}`}
            onClick={() => {
              setReturnToPrevious(rule.name);
            }}
          >
            Go to panel
          </LinkButton>
        );
      }
    }
  }

  if (rulerRuleType.grafana.alertingRule(rule.rulerRule)) {
    buttons.push(
      <Fragment key="history">
        <Button
          size="sm"
          icon="history"
          onClick={() => rulerRuleType.grafana.rule(rule.rulerRule) && showStateHistoryModal(rule.rulerRule)}
        >
          Show state history
        </Button>
        {StateHistoryModal}
      </Fragment>
    );
  }

  return buttons.length ? <Stack>{buttons}</Stack> : null;
};

export default RuleDetailsButtons;
