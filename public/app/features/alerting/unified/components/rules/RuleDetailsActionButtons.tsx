import { css } from '@emotion/css';
import React, { FC, Fragment } from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { Button, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { useStateHistoryModal } from '../../hooks/useStateHistoryModal';
import { getAlertmanagerByUid } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { createExploreLink, makeRuleBasedSilenceLink } from '../../utils/misc';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleDetailsActionButtons: FC<Props> = ({ rule, rulesSource }) => {
  const style = useStyles2(getStyles);
  const { group } = rule;
  const alertId = isGrafanaRulerRule(rule.rulerRule) ? rule.rulerRule.grafana_alert.id ?? '' : '';
  const { StateHistoryModal, showStateHistoryModal } = useStateHistoryModal(alertId);

  const alertmanagerSourceName = isGrafanaRulesSource(rulesSource)
    ? rulesSource
    : getAlertmanagerByUid(rulesSource.jsonData.alertmanagerUid)?.name;

  const hasExplorePermission = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  const buttons: JSX.Element[] = [];

  const isFederated = isFederatedRuleGroup(group);

  // explore does not support grafana rule queries atm
  // neither do "federated rules"
  if (isCloudRulesSource(rulesSource) && hasExplorePermission && !isFederated) {
    buttons.push(
      <LinkButton
        className={style.button}
        size="xs"
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
        className={style.button}
        size="xs"
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
          className={style.button}
          size="xs"
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
            className={style.button}
            size="xs"
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

  if (alertmanagerSourceName && contextSrv.hasAccess(AccessControlAction.AlertingInstanceCreate, contextSrv.isEditor)) {
    buttons.push(
      <LinkButton
        className={style.button}
        size="xs"
        key="silence"
        icon="bell-slash"
        target="__blank"
        href={makeRuleBasedSilenceLink(alertmanagerSourceName, rule)}
      >
        Silence
      </LinkButton>
    );
  }

  if (alertId) {
    buttons.push(
      <Fragment key="history">
        <Button className={style.button} size="xs" icon="history" onClick={() => showStateHistoryModal()}>
          Show state history
        </Button>
        {StateHistoryModal}
      </Fragment>
    );
  }

  if (buttons.length) {
    return (
      <div className={style.wrapper}>
        <HorizontalGroup width="auto">{buttons.length ? buttons : <div />}</HorizontalGroup>
      </div>
    );
  }

  return null;
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    padding: ${theme.spacing(2)} 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
  button: css`
    height: 24px;
    margin-top: ${theme.spacing(1)};
    font-size: ${theme.typography.size.sm};
  `,
});
