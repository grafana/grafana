import { GrafanaTheme, rangeUtil } from '@grafana/data';
import { ConfirmModal, useStyles } from '@grafana/ui';
import { CombinedRuleGroup, RulesSource } from 'app/types/unified-alerting';
import React, { FC, Fragment, useState } from 'react';
import { hashRulerRule, isAlertingRule } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { css, cx } from '@emotion/css';
import { TimeToNow } from '../TimeToNow';
import { StateTag } from '../StateTag';
import { RuleDetails } from './RuleDetails';
import { getAlertTableStyles } from '../../styles/table';
import { ActionIcon } from './ActionIcon';
import { createExploreLink } from '../../utils/misc';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { RulerRuleDTO } from 'app/types/unified-alerting-dto';
import { useDispatch } from 'react-redux';
import { deleteRuleAction } from '../../state/actions';
import { useHasRuler } from '../../hooks/useHasRuler';

interface Props {
  namespace: string;
  group: CombinedRuleGroup;
  rulesSource: RulesSource;
}

export const RulesTable: FC<Props> = ({ group, rulesSource, namespace }) => {
  const { rules } = group;
  const dispatch = useDispatch();

  const hasRuler = useHasRuler(rulesSource);

  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const [ruleToDelete, setRuleToDelete] = useState<RulerRuleDTO>();

  const toggleExpandedState = (ruleKey: string) =>
    setExpandedKeys(
      expandedKeys.includes(ruleKey) ? expandedKeys.filter((key) => key !== ruleKey) : [...expandedKeys, ruleKey]
    );

  const deleteRule = () => {
    if (ruleToDelete) {
      dispatch(
        deleteRuleAction({
          ruleSourceName: getRulesSourceName(rulesSource),
          groupName: group.name,
          namespace,
          ruleHash: hashRulerRule(ruleToDelete),
        })
      );
      setRuleToDelete(undefined);
    }
  };

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
          {(() => {
            const seenKeys: string[] = [];
            return rules.map((rule, ruleIdx) => {
              let key = JSON.stringify([rule.promRule?.type, rule.labels, rule.query, rule.name, rule.annotations]);
              if (seenKeys.includes(key)) {
                key += `-${ruleIdx}`;
              }
              seenKeys.push(key);
              const isExpanded = expandedKeys.includes(key);
              const { promRule, rulerRule } = rule;
              const statuses = [
                promRule?.health,
                hasRuler && promRule && !rulerRule ? 'deleting' : '',
                hasRuler && rulerRule && !promRule ? 'creating' : '',
              ].filter((x) => !!x);
              return (
                <Fragment key={key}>
                  <tr className={ruleIdx % 2 === 0 ? tableStyles.evenRow : undefined}>
                    <td className={styles.relative}>
                      <div className={cx(styles.ruleTopGuideline, styles.guideline)} />
                      {!(ruleIdx === rules.length - 1) && (
                        <div className={cx(styles.ruleBottomGuideline, styles.guideline)} />
                      )}
                      <CollapseToggle
                        isCollapsed={!isExpanded}
                        onToggle={() => toggleExpandedState(key)}
                        data-testid="rule-collapse-toggle"
                      />
                    </td>
                    <td>{promRule && isAlertingRule(promRule) ? <StateTag status={promRule.state} /> : 'n/a'}</td>
                    <td>{rule.name}</td>
                    <td>{statuses.join(', ') || 'n/a'}</td>
                    <td>
                      {promRule?.lastEvaluation && promRule.evaluationTime ? (
                        <>
                          <TimeToNow date={promRule.lastEvaluation} />, for{' '}
                          {rangeUtil.secondsToHms(promRule.evaluationTime)}
                        </>
                      ) : (
                        'n/a'
                      )}
                    </td>
                    <td className={styles.actionsCell}>
                      {isCloudRulesSource(rulesSource) && (
                        <ActionIcon
                          icon="compass"
                          tooltip="view in explore"
                          target="__blank"
                          href={createExploreLink(rulesSource.name, rule.query)}
                        />
                      )}
                      {!!rulerRule && <ActionIcon icon="pen" tooltip="edit rule" />}
                      {!!rulerRule && (
                        <ActionIcon icon="trash-alt" tooltip="delete rule" onClick={() => setRuleToDelete(rulerRule)} />
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={ruleIdx % 2 === 0 ? tableStyles.evenRow : undefined}>
                      <td className={styles.relative}>
                        {!(ruleIdx === rules.length - 1) && (
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
            });
          })()}
        </tbody>
      </table>
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
