import { css } from '@emotion/css';
import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Button, ConfirmModal, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import React, { FC, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { deleteRuleAction } from '../../state/actions';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { createExploreLink } from '../../utils/misc';
import { getRuleIdentifier, stringifyRuleIdentifier } from '../../utils/rules';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleDetailsActionButtons: FC<Props> = ({ rule, rulesSource }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const style = useStyles2(getStyles);
  const { namespace, group, rulerRule } = rule;
  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const leftButtons: JSX.Element[] = [];
  const rightButtons: JSX.Element[] = [];

  const { isEditable } = useIsRuleEditable(rulerRule);

  const deleteRule = () => {
    if (ruleToDelete && ruleToDelete.rulerRule) {
      dispatch(
        deleteRuleAction(
          getRuleIdentifier(
            getRulesSourceName(ruleToDelete.namespace.rulesSource),
            ruleToDelete.namespace.name,
            ruleToDelete.group.name,
            ruleToDelete.rulerRule
          )
        )
      );
      setRuleToDelete(undefined);
    }
  };

  // explore does not support grafana rule queries atm
  if (isCloudRulesSource(rulesSource) && contextSrv.isEditor) {
    leftButtons.push(
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
    leftButtons.push(
      <LinkButton
        className={style.button}
        size="xs"
        key="runbook"
        variant="primary"
        icon="book"
        target="__blank"
        href={rule.annotations[Annotation.runbookURL]}
      >
        View runbook
      </LinkButton>
    );
  }
  if (rule.annotations[Annotation.dashboardUID]) {
    const dashboardUID = rule.annotations[Annotation.dashboardUID];
    if (dashboardUID) {
      leftButtons.push(
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
        leftButtons.push(
          <LinkButton
            className={style.button}
            size="xs"
            key="dashboard"
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

  if (isEditable && rulerRule) {
    const editURL = urlUtil.renderUrl(
      `/alerting/${encodeURIComponent(
        stringifyRuleIdentifier(
          getRuleIdentifier(getRulesSourceName(rulesSource), namespace.name, group.name, rulerRule)
        )
      )}/edit`,
      {
        returnTo: location.pathname + location.search,
      }
    );

    rightButtons.push(
      <LinkButton className={style.button} size="xs" key="edit" variant="secondary" icon="pen" href={editURL}>
        Edit
      </LinkButton>,
      <Button
        className={style.button}
        size="xs"
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
  if (leftButtons.length || rightButtons.length) {
    return (
      <>
        <div className={style.wrapper}>
          <HorizontalGroup width="auto">{leftButtons.length ? leftButtons : <div />}</HorizontalGroup>
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
