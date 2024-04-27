import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { Fragment, useState } from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { config, useReturnToPrevious } from '@grafana/runtime';
import { Button, ConfirmModal, Dropdown, HorizontalGroup, Icon, LinkButton, Menu, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { CombinedRule, RuleIdentifier, RulesSource } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { useStateHistoryModal } from '../../hooks/useStateHistoryModal';
import { deleteRuleAction } from '../../state/actions';
import { getAlertmanagerByUid } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import {
  createExploreLink,
  createShareLink,
  isLocalDevEnv,
  isOpenSourceEdition,
  makeRuleBasedSilenceLink,
} from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { DeclareIncidentButton } from '../bridges/DeclareIncidentButton';

import { RedirectToCloneRule } from './CloneRule';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleDetailsActionButtons = ({ rule, rulesSource }: Props) => {
  const style = useStyles2(getStyles);
  const { group } = rule;
  const { StateHistoryModal, showStateHistoryModal } = useStateHistoryModal();
  const dispatch = useDispatch();

  const setReturnToPrevious = useReturnToPrevious();

  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();
  const [redirectToClone, setRedirectToClone] = useState<
    { identifier: RuleIdentifier; isProvisioned: boolean } | undefined
  >(undefined);

  const alertmanagerSourceName = isGrafanaRulesSource(rulesSource)
    ? rulesSource
    : getAlertmanagerByUid(rulesSource.jsonData.alertmanagerUid)?.name;

  const [silenceSupported, silenceAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Silence);
  const [exploreSupported, exploreAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Explore);

  const buttons: JSX.Element[] = [];
  const rightButtons: JSX.Element[] = [];
  const moreActionsButtons: React.ReactElement[] = [];

  const deleteRule = () => {
    if (ruleToDelete && ruleToDelete.rulerRule) {
      const identifier = ruleId.fromRulerRule(
        getRulesSourceName(ruleToDelete.namespace.rulesSource),
        ruleToDelete.namespace.name,
        ruleToDelete.group.name,
        ruleToDelete.rulerRule
      );

      dispatch(deleteRuleAction(identifier, { navigateTo: undefined }));
      setRuleToDelete(undefined);
    }
  };

  const isFederated = isFederatedRuleGroup(group);

  const isFiringRule = isAlertingRule(rule.promRule) && rule.promRule.state === PromAlertingRuleState.Firing;

  const canSilence = silenceSupported && silenceAllowed && alertmanagerSourceName;

  const buildShareUrl = () => createShareLink(rulesSource, rule);

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
    const isReturnToPreviousEnabled = config.featureToggles.returnToPrevious;
    if (dashboardUID) {
      buttons.push(
        <LinkButton
          size="sm"
          key="dashboard"
          variant="primary"
          icon="apps"
          target={isReturnToPreviousEnabled ? undefined : '_blank'}
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
            target={isReturnToPreviousEnabled ? undefined : '_blank'}
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

  if (canSilence) {
    buttons.push(
      <LinkButton
        size="sm"
        key="silence"
        icon="bell-slash"
        target="_blank"
        href={makeRuleBasedSilenceLink(alertmanagerSourceName, rule)}
      >
        Silence
      </LinkButton>
    );
  }

  if (isGrafanaRulerRule(rule.rulerRule)) {
    buttons.push(
      <Fragment key="history">
        <Button
          size="sm"
          icon="history"
          onClick={() => isGrafanaRulerRule(rule.rulerRule) && showStateHistoryModal(rule.rulerRule)}
        >
          Show state history
        </Button>
        {StateHistoryModal}
      </Fragment>
    );
  }

  if (isFiringRule && shouldShowDeclareIncidentButton()) {
    buttons.push(
      <Fragment key="declare-incident">
        <DeclareIncidentButton title={rule.name} url={buildShareUrl()} />
      </Fragment>
    );
  }

  if (buttons.length || rightButtons.length || moreActionsButtons.length) {
    return (
      <>
        <div className={style.wrapper}>
          <HorizontalGroup width="auto">{buttons.length ? buttons : <div />}</HorizontalGroup>
          <HorizontalGroup width="auto">
            {rightButtons.length && rightButtons}
            {moreActionsButtons.length && (
              <Dropdown
                overlay={
                  <Menu>
                    {moreActionsButtons.map((action) => (
                      <React.Fragment key={uniqueId('action_')}>{action}</React.Fragment>
                    ))}
                  </Menu>
                }
              >
                <Button variant="secondary" size="sm">
                  More
                  <Icon name="angle-down" />
                </Button>
              </Dropdown>
            )}
          </HorizontalGroup>
        </div>
        {!!ruleToDelete && (
          <ConfirmModal
            isOpen={true}
            title="Delete rule"
            body="Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?"
            confirmText="Yes, delete"
            icon="exclamation-triangle"
            onConfirm={deleteRule}
            onDismiss={() => setRuleToDelete(undefined)}
          />
        )}
        {redirectToClone && (
          <RedirectToCloneRule
            identifier={redirectToClone.identifier}
            isProvisioned={redirectToClone.isProvisioned}
            onDismiss={() => setRedirectToClone(undefined)}
          />
        )}
      </>
    );
  }

  return null;
};

/**
 * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
 * We should show it in development mode
 */
function shouldShowDeclareIncidentButton() {
  return !isOpenSourceEdition() || isLocalDevEnv();
}

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: 0 0 ${theme.spacing(2)} 0;
    gap: ${theme.spacing(1)};
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
});
