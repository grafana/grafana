import { GrafanaTheme } from '@grafana/data';
import { Button, Icon, useStyles } from '@grafana/ui';
import { RuleGroup } from 'app/types/unified-alerting/internal';
import React, { FC, Fragment, useState } from 'react';
import { isAlertingRule, ruleKey } from '../../utils/rules';
import { ExpandedToggle } from '../ExpandedToggle';
import { css } from 'emotion';
import { TimeToNow } from '../TimeToNow';
import { formatDuration } from '../../utils/formatting';
import { StateTag } from '../StateTag';

interface Props {
  namespace: string;
  group: RuleGroup;
}

export const RulesTable: FC<Props> = ({ group }) => {
  const { rules } = group;

  const styles = useStyles(getStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const toggleExpandedState = (ruleKey: string) =>
    setExpandedKeys(
      expandedKeys.includes(ruleKey) ? expandedKeys.filter((key) => key !== ruleKey) : [...expandedKeys, ruleKey]
    );

  if (!rules.length) {
    return <p>No rules.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colExpand} />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th></th>
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
                <tr className={idx % 2 === 0 ? styles.evenRow : undefined}>
                  <td className={styles.expandCell}>
                    <div className={styles.ruleGuideline} />
                    <ExpandedToggle isExpanded={isExpanded} onToggle={() => toggleExpandedState(key)} />
                  </td>
                  <td>{isAlertingRule(rule) ? <StateTag status={rule.state} /> : 'n/a'}</td>
                  <td>{rule.name}</td>
                  <td>{rule.health}</td>
                  <td>
                    {rule.lastEvaluation && rule.evaluationTime ? (
                      <>
                        <TimeToNow date={rule.lastEvaluation} />, for {formatDuration(rule.evaluationTime)}
                      </>
                    ) : (
                      'n/a'
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <Button className={styles.buttonSilence} variant="secondary" icon="bell" size="xs">
                      Silence
                    </Button>
                    <Icon name="compass" />
                    <Icon name="pen" />
                    <Icon name="trash-alt" />
                  </td>
                </tr>
                {isExpanded && (
                  <tr className={idx % 2 === 0 ? styles.evenRow : undefined}>
                    <td></td>
                    <td colSpan={5}>{JSON.stringify(rule, null, 2)}</td>
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
  buttonSilence: css`
    height: 24px;
    font-size: ${theme.typography.size.sm};
  `,
  colExpand: css`
    width: 36px;
  `,
  expandCell: css`
    position: relative;
  `,
  ruleGuideline: css`
    width: 23px;
    position: absolute;
    height: 19px;
    border-bottom: 1px solid ${theme.colors.border3};
    border-left: 1px solid ${theme.colors.border3};
    top: 0;
    left: -32px;
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
