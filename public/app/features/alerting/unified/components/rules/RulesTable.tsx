import { GrafanaTheme } from '@grafana/data';
import { Button, Icon, useStyles } from '@grafana/ui';
import { RuleGroup } from 'app/types/unified-alerting/internal';
import React, { FC, Fragment, useState } from 'react';
import { isAlertingRule, ruleKey } from '../../utils/rules';
import { ExpandedToggle } from '../ExpandedToggle';
import { css } from 'emotion';

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
        <thead>
          <th></th>
          <th>State</th>
          <th>Name</th>
          <th>Status</th>
          <th>Evaluation</th>
          <th>Actions</th>
        </thead>
        <tbody>
          {rules.map((rule, idx) => {
            const key = ruleKey(rule);
            const isExpanded = expandedKeys.includes(key);
            return (
              <Fragment key={key}>
                <tr className={idx % 2 === 0 ? styles.evenRow : undefined}>
                  <td>
                    <ExpandedToggle isExpanded={isExpanded} onToggle={() => toggleExpandedState(key)} />
                  </td>
                  <td>{isAlertingRule(rule) ? rule.state : ''}</td>
                  <td>{rule.name}</td>
                  <td>{rule.health}</td>
                  <td>
                    {rule.lastEvaluation} for {rule.evaluationTime}
                  </td>
                  <td>
                    <Button variant="secondary" icon="bell" size="xs">
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
    margin-left: 26px;
    width: 100%;
    padding: ${theme.spacing.sm};
    background-color: ${theme.colors.bg2};
    border-radius: 3px;
  `,
  table: css`
    width: 100%;
    border-radius: 3px;
    border: solid 1px ${theme.colors.border1};
  `,
  evenRow: css`
    background-color: ${theme.colors.bodyBg};
  `,
});
