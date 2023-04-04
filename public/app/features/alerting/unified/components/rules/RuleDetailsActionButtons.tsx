import { css } from '@emotion/css';
import React, { Fragment, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, textUtil, urlUtil } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { config } from '@grafana/runtime';
import { Button, ClipboardButton, ConfirmModal, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction, useDispatch } from 'app/types';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { useStateHistoryModal } from '../../hooks/useStateHistoryModal';
import { deleteRuleAction } from '../../state/actions';
import { getRulesPermissions } from '../../utils/access-control';
import { getAlertmanagerByUid } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { createExploreLink, makeRuleBasedSilenceLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { DeclareIncident } from '../bridges/DeclareIncidentButton';

import { CloneRuleButton } from './CloneRuleButton';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
  isViewMode: boolean;
}

export const RuleDetailsActionButtons = ({ rule, rulesSource, isViewMode }: Props) => {
  const style = useStyles2(getStyles);
  const { namespace, group, rulerRule } = rule;
  const { StateHistoryModal, showStateHistoryModal } = useStateHistoryModal();
  const dispatch = useDispatch();
  const location = useLocation();
  const notifyApp = useAppNotification();

  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const alertmanagerSourceName = isGrafanaRulesSource(rulesSource)
    ? rulesSource
    : getAlertmanagerByUid(rulesSource.jsonData.alertmanagerUid)?.name;

  const hasExplorePermission = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  const buttons: JSX.Element[] = [];
  const rightButtons: JSX.Element[] = [];

  const deleteRule = () => {
    if (ruleToDelete && ruleToDelete.rulerRule) {
      const identifier = ruleId.fromRulerRule(
        getRulesSourceName(ruleToDelete.namespace.rulesSource),
        ruleToDelete.namespace.name,
        ruleToDelete.group.name,
        ruleToDelete.rulerRule
      );

      dispatch(deleteRuleAction(identifier, { navigateTo: isViewMode ? '/alerting/list' : undefined }));
      setRuleToDelete(undefined);
    }
  };
  const buildShareUrl = () => {
    if (isCloudRulesSource(rulesSource)) {
      const { appUrl, appSubUrl } = config;
      const baseUrl = appSubUrl !== '' ? `${appUrl}${appSubUrl}/` : config.appUrl;
      const ruleUrl = `${encodeURIComponent(rulesSource.name)}/${encodeURIComponent(rule.name)}`;
      return `${baseUrl}alerting/${ruleUrl}/find`;
    }

    return window.location.href.split('?')[0];
  };

  const isFederated = isFederatedRuleGroup(group);
  const rulesSourceName = getRulesSourceName(rulesSource);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  const isFiringRule = isAlertingRule(rule.promRule) && rule.promRule.state === PromAlertingRuleState.Firing;

  const rulesPermissions = getRulesPermissions(rulesSourceName);
  const hasCreateRulePermission = contextSrv.hasPermission(rulesPermissions.create);
  const { isEditable, isRemovable } = useIsRuleEditable(rulesSourceName, rulerRule);
  const canSilence = useCanSilence(rule);

  const returnTo = location.pathname + location.search;
  // explore does not support grafana rule queries atm
  // neither do "federated rules"
  if (isCloudRulesSource(rulesSource) && hasExplorePermission && !isFederated) {
    buttons.push(
      <LinkButton
        size="sm"
        key="explore"
        variant="primary"
        icon="chart-line"
        target="__blank"
        href={createExploreLink(rulesSource.name, rule.query)}
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
        target="__blank"
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
          target="__blank"
          href={`d/${encodeURIComponent(dashboardUID)}`}
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
            target="__blank"
            href={`d/${encodeURIComponent(dashboardUID)}?viewPanel=${encodeURIComponent(panelId)}`}
          >
            Go to panel
          </LinkButton>
        );
      }
    }
  }

  if (canSilence && alertmanagerSourceName) {
    buttons.push(
      <LinkButton
        size="sm"
        key="silence"
        icon="bell-slash"
        target="__blank"
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
        <DeclareIncident title={rule.name} url={buildShareUrl()} />
      </Fragment>
    );
  }

  if (isViewMode && rulerRule) {
    const sourceName = getRulesSourceName(rulesSource);
    const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);

    if (isEditable && !isFederated) {
      rightButtons.push(
        <ClipboardButton
          key="copy"
          icon="copy"
          onClipboardError={(copiedText) => {
            notifyApp.error('Error while copying URL', copiedText);
          }}
          size="sm"
          getText={buildShareUrl}
        >
          Copy link to rule
        </ClipboardButton>
      );

      if (!isProvisioned) {
        const editURL = urlUtil.renderUrl(
          `${config.appSubUrl}/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`,
          {
            returnTo,
          }
        );

        rightButtons.push(
          <LinkButton size="sm" key="edit" variant="secondary" icon="pen" href={editURL}>
            Edit
          </LinkButton>
        );
      }
    }

    if (hasCreateRulePermission && !isFederated) {
      rightButtons.push(
        <CloneRuleButton key="clone" text="Copy" ruleIdentifier={identifier} isProvisioned={isProvisioned} />
      );
    }

    if (isRemovable && !isFederated && !isProvisioned) {
      rightButtons.push(
        <Button
          size="sm"
          type="button"
          key="delete"
          variant="secondary"
          icon="trash-alt"
          onClick={() => setRuleToDelete(rule)}
        >
          Delete
        </Button>
      );
    }
  }

  if (buttons.length || rightButtons.length) {
    return (
      <>
        <div className={style.wrapper}>
          <HorizontalGroup width="auto">{buttons.length ? buttons : <div />}</HorizontalGroup>
          <HorizontalGroup width="auto">{rightButtons.length ? rightButtons : <div />}</HorizontalGroup>
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
  const buildInfo = config.buildInfo;
  const isOpenSourceEdition = buildInfo.edition === GrafanaEdition.OpenSource;
  const isDevelopment = buildInfo.env === 'development';

  return !isOpenSourceEdition || isDevelopment;
}

/**
 * We don't want to show the silence button if either
 * 1. the user has no permissions to create silences
 * 2. the admin has configured to only send instances to external AMs
 */
function useCanSilence(rule: CombinedRule) {
  const isGrafanaManagedRule = isGrafanaRulerRule(rule.rulerRule);

  const { useGetAlertmanagerChoiceStatusQuery } = alertmanagerApi;
  const { currentData: amConfigStatus, isLoading } = useGetAlertmanagerChoiceStatusQuery(undefined, {
    skip: !isGrafanaManagedRule,
  });

  if (!isGrafanaManagedRule || isLoading) {
    return false;
  }

  const hasPermissions = contextSrv.hasAccess(AccessControlAction.AlertingInstanceCreate, contextSrv.isEditor);

  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;

  return hasPermissions && (!interactsOnlyWithExternalAMs || interactsWithAll);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: ${theme.spacing(2)} 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
});
