import { RuleGroup } from 'app/types/unified-alerting/internal';
import React, { FC, useMemo, useState } from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { DataSourceInstanceSettings, GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { isAlertingRule } from '../../utils/rules';
import { PromAlertingRuleState } from 'app/types/unified-alerting/dto';
import { StatusColoredText } from '../StatusColoredText';

interface Props {
  namespace: string;
  datasource?: DataSourceInstanceSettings;
  group: RuleGroup;
}

export const RulesGroup: FC<Props> = ({ group, namespace, datasource }) => {
  const styles = useStyles(getStyles);

  const [isExpanded, setIsExpanded] = useState(false);

  const stats = useMemo(
    (): Record<PromAlertingRuleState, number> =>
      group.rules.reduce<Record<PromAlertingRuleState, number>>(
        (stats, rule) => {
          if (isAlertingRule(rule)) {
            stats[rule.state] += 1;
          }
          return stats;
        },
        {
          [PromAlertingRuleState.Firing]: 0,
          [PromAlertingRuleState.Pending]: 0,
          [PromAlertingRuleState.Inactive]: 0,
        }
      ),
    [group]
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button className={styles.expandButton} onClick={() => setIsExpanded(!isExpanded)}>
          <Icon size="xl" name={isExpanded ? 'angle-down' : 'angle-right'} />
        </button>
        <Icon name={isExpanded ? 'folder-open' : 'folder'} />
        <h6 className={styles.heading}>
          {namespace} &gt; {group.name}
        </h6>
        <div className={styles.spacer} />
        {datasource && (
          <div className={styles.datasourceOrigin}>
            <img className={styles.datasourceIcon} src={datasource.meta.info.logos.small} /> {datasource?.name}
          </div>
        )}
        <div>
          {group.rules.length} rules:{' '}
          <StatusColoredText status={PromAlertingRuleState.Firing}>
            {stats[PromAlertingRuleState.Firing]} firing
          </StatusColoredText>
          ,{' '}
          <StatusColoredText status={PromAlertingRuleState.Pending}>
            {stats[PromAlertingRuleState.Pending]} pending
          </StatusColoredText>
        </div>
      </div>
      {isExpanded && (
        <div>
          {group.rules.map((rule, index) => (
            <p key={index}>{JSON.stringify(rule, null, 2)}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    & + & {
      margin-top: ${theme.spacing.md};
    }
  `,
  header: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} 0;
    background-color: ${theme.colors.bg2};
  `,
  heading: css`
    margin-left: ${theme.spacing.xs};
    margin-bottom: 0;
  `,
  spacer: css`
    flex: 1;
  `,
  expandButton: css`
    background: none;
    border: none;
    margin-top: -${theme.spacing.sm};
    margin-bottom: -${theme.spacing.sm};

    svg {
      margin-bottom: 0;
    }
  `,
  datasourceIcon: css`
    width: ${theme.spacing.md};
    height: ${theme.spacing.md};
  `,
  datasourceOrigin: css`
    margin-right: 1em;
    color: ${theme.colors.textFaint};
  `,
});
