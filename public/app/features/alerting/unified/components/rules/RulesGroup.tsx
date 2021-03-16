import { RuleGroup } from 'app/types/unified-alerting/internal';
import React, { FC, useMemo, useState, Fragment } from 'react';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { DataSourceInstanceSettings, GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { isAlertingRule } from '../../utils/rules';
import { PromAlertingRuleState } from 'app/types/unified-alerting/dto';
import { StatusColoredText } from '../StatusColoredText';
import { ExpandedToggle } from '../ExpandedToggle';
import { RulesTable } from './RulesTable';

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

  const statsComponents: React.ReactNode[] = [];
  if (stats[PromAlertingRuleState.Firing]) {
    statsComponents.push(
      <StatusColoredText key="firing" status={PromAlertingRuleState.Firing}>
        {stats[PromAlertingRuleState.Firing]} firing
      </StatusColoredText>
    );
  }
  if (stats[PromAlertingRuleState.Pending]) {
    statsComponents.push(
      <StatusColoredText key="firing" status={PromAlertingRuleState.Pending}>
        {stats[PromAlertingRuleState.Pending]} pending
      </StatusColoredText>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <ExpandedToggle className={styles.expandButton} isExpanded={isExpanded} onToggle={setIsExpanded} />
        <Icon name={isExpanded ? 'folder-open' : 'folder'} />
        {datasource && (
          <Tooltip content={datasource.name} placement="top">
            <img className={styles.datasourceIcon} src={datasource.meta.info.logos.small} />
          </Tooltip>
        )}
        <h6 className={styles.heading}>
          {namespace} &gt; {group.name}
        </h6>
        <div className={styles.spacer} />
        <div className={styles.headerStats}>
          {group.rules.length} rules
          {!!statsComponents.length && (
            <>
              :{' '}
              {statsComponents.reduce<React.ReactNode[]>(
                (prev, curr, idx) => (prev.length ? [<Fragment key={idx}>, </Fragment>, curr] : [curr]),
                []
              )}
            </>
          )}
        </div>
        <div className={styles.actionsSeparator}>|</div>
        <div className={styles.actionIcons}>
          <Icon title="edit" name="pen" />
          <Icon title="manage permissions" name="lock" />
        </div>
      </div>
      {isExpanded && <RulesTable namespace={namespace} group={group} />}
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
  headerStats: css`
    span {
      vertical-align: middle;
    }
  `,
  heading: css`
    margin-left: ${theme.spacing.sm};
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
    margin-left: ${theme.spacing.sm};
  `,
  datasourceOrigin: css`
    margin-right: 1em;
    color: ${theme.colors.textFaint};
  `,
  actionsSeparator: css`
    margin: 0 ${theme.spacing.sm};
  `,
  actionIcons: css`
    & > * + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
});
