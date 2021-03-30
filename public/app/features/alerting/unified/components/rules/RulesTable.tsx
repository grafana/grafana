import { GrafanaTheme, rangeUtil } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { RuleGroup, RulesSource } from 'app/types/unified-alerting';
import React, { FC, Fragment, useState } from 'react';
import { isAlertingRule, ruleKey } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { css, cx } from 'emotion';
import { TimeToNow } from '../TimeToNow';
import { StateTag } from '../StateTag';
import { RuleDetails } from './RuleDetails';
import { getAlertTableStyles } from '../../styles/table';
import { ActionIcon } from './ActionIcon';
import { createExploreLink } from '../../utils/misc';
import { isCloudRulesSource } from '../../utils/datasource';
import { ActionButton } from './ActionButton';

interface Props {
  namespace: string;
  group: RuleGroup;
  rulesSource: RulesSource;
}

export const RulesTable: FC<Props> = ({ group, rulesSource }) => {
  const { rules } = group;

  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const toggleExpandedState = (ruleKey: string) =>
    setExpandedKeys(
      expandedKeys.includes(ruleKey) ? expandedKeys.filter((key) => key !== ruleKey) : [...expandedKeys, ruleKey]
    );

  if (!rules.length) {
    return <div className={styles.wrapper}>Folder is empty.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={tableStyles.table} data-testid="rules-table">
        <colgroup>
          <col className={styles.colExpand} />
          <col className={styles.colState} />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.relative}>
              <div className={cx(styles.headerGuideline, styles.guideline)} />
            </th>
            <th>State</th>
            <th>Name</th>
            <th>Status</th>
            <th>Evaluation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, idx) => {
            const key = ruleKey(rule);
            const isExpanded = expandedKeys.includes(key);
            return (
              <Fragment key={key}>
                <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                  <td className={styles.relative}>
                    <div className={cx(styles.ruleTopGuideline, styles.guideline)} />
                    {!(idx === rules.length - 1) && (
                      <div className={cx(styles.ruleBottomGuideline, styles.guideline)} />
                    )}
                    <CollapseToggle
                      isCollapsed={!isExpanded}
                      onToggle={() => toggleExpandedState(key)}
                      data-testid="rule-collapse-toggle"
                    />
                  </td>
                  <td>{isAlertingRule(rule) ? <StateTag status={rule.state} /> : 'n/a'}</td>
                  <td>{rule.name}</td>
                  <td>{rule.health}</td>
                  <td>
                    {rule.lastEvaluation && rule.evaluationTime ? (
                      <>
                        <TimeToNow date={rule.lastEvaluation} />, for {rangeUtil.secondsToHms(rule.evaluationTime)}
                      </>
                    ) : (
                      'n/a'
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <ActionButton icon="bell-slash">Silence</ActionButton>
                    {isCloudRulesSource(rulesSource) && (
                      <ActionIcon
                        icon="compass"
                        tooltip="view in explore"
                        href={createExploreLink(rulesSource.name, rule.query)}
                      />
                    )}
                    <ActionIcon icon="pen" tooltip="edit rule" />
                    <ActionIcon icon="trash-alt" tooltip="delete rule" />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
                    <td className={styles.relative}>
                      {!(idx === rules.length - 1) && (
                        <div className={cx(styles.ruleContentGuideline, styles.guideline)} />
                      )}
                    </td>
                    <td colSpan={5}>
                      <RuleDetails rulesSource={rulesSource} rule={rule} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    margin-top: ${theme.spacing.md};
    margin-left: 36px;
    width: auto;
    padding: ${theme.spacing.sm};
    background-color: ${theme.colors.bg2};
    border-radius: 3px;
  `,
  table: css`
    width: 100%;
    border-radius: 3px;
    border: solid 1px ${theme.colors.border3};

    th {
      padding: ${theme.spacing.sm};
    }

    td + td {
      padding: 0 ${theme.spacing.sm};
    }

    tr {
      height: 38px;
    }
  `,
  evenRow: css`
    background-color: ${theme.colors.bodyBg};
  `,
  colExpand: css`
    width: 36px;
  `,
  colState: css`
    width: 110px;
  `,
  relative: css`
    position: relative;
  `,
  guideline: css`
    left: -27px;
    border-left: 1px solid ${theme.colors.border3};
    position: absolute;
  `,
  ruleTopGuideline: css`
    width: 18px;
    border-bottom: 1px solid ${theme.colors.border3};
    top: 0;
    bottom: 50%;
  `,
  ruleBottomGuideline: css`
    top: 50%;
    bottom: 0;
  `,
  ruleContentGuideline: css`
    top: 0;
    bottom: 0;
  `,
  headerGuideline: css`
    top: -24px;
    bottom: 0;
  `,
  actionsCell: css`
    text-align: right;
    width: 1%;
    white-space: nowrap;

    & > * + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
});
