import { GrafanaTheme } from '@grafana/data';
import { ConfirmModal, useStyles } from '@grafana/ui';
import React, { FC, Fragment, useState } from 'react';
import { getRuleIdentifier, isAlertingRule, stringifyRuleIdentifier } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { css, cx } from '@emotion/css';
import { StateTag } from '../StateTag';
import { RuleDetails } from './RuleDetails';
import { getAlertTableStyles } from '../../styles/table';
import { ActionIcon } from './ActionIcon';
import { createExploreLink } from '../../utils/misc';
import { getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { useDispatch } from 'react-redux';
import { deleteRuleAction } from '../../state/actions';
import { useHasRuler } from '../../hooks/useHasRuler';
import { CombinedRule } from 'app/types/unified-alerting';

interface Props {
  rules: CombinedRule[];
  showGuidelines?: boolean;
  showGroupColumn?: boolean;
  emptyMessage?: string;
}

export const RulesTable: FC<Props> = ({
  rules,
  showGuidelines = false,
  emptyMessage = 'No rules found.',
  showGroupColumn = false,
}) => {
  const dispatch = useDispatch();

  const hasRuler = useHasRuler();

  const styles = useStyles(getStyles);
  const tableStyles = useStyles(getAlertTableStyles);

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const [ruleToDelete, setRuleToDelete] = useState<CombinedRule>();

  const toggleExpandedState = (ruleKey: string) =>
    setExpandedKeys(
      expandedKeys.includes(ruleKey) ? expandedKeys.filter((key) => key !== ruleKey) : [...expandedKeys, ruleKey]
    );

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

  const wrapperClass = cx(styles.wrapper, { [styles.wrapperMargin]: showGuidelines });

  if (!rules.length) {
    return <div className={wrapperClass}>{emptyMessage}</div>;
  }

  return (
    <div className={wrapperClass}>
      <table className={tableStyles.table} data-testid="rules-table">
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.colState} />
          <col />
          <col />
          <col />
          <col />
          {showGroupColumn && <col />}
        </colgroup>
        <thead>
          <tr>
            <th className={styles.relative}>
              {showGuidelines && <div className={cx(styles.headerGuideline, styles.guideline)} />}
            </th>
            <th>State</th>
            <th>Name</th>
            {showGroupColumn && <th>Group</th>}
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const seenKeys: string[] = [];
            return rules.map((rule, ruleIdx) => {
              const { namespace, group } = rule;
              const { rulesSource } = namespace;
              let key = JSON.stringify([rule.promRule?.type, rule.labels, rule.query, rule.name, rule.annotations]);
              if (seenKeys.includes(key)) {
                key += `-${ruleIdx}`;
              }
              seenKeys.push(key);
              const isExpanded = expandedKeys.includes(key);
              const { promRule, rulerRule } = rule;
              const statuses = [
                promRule?.health,
                hasRuler(rulesSource) && promRule && !rulerRule ? 'deleting' : '',
                hasRuler(rulesSource) && rulerRule && !promRule ? 'creating' : '',
              ].filter((x) => !!x);
              return (
                <Fragment key={key}>
                  <tr className={ruleIdx % 2 === 0 ? tableStyles.evenRow : undefined}>
                    <td className={styles.relative}>
                      {showGuidelines && (
                        <>
                          <div className={cx(styles.ruleTopGuideline, styles.guideline)} />
                          {!(ruleIdx === rules.length - 1) && (
                            <div className={cx(styles.ruleBottomGuideline, styles.guideline)} />
                          )}
                        </>
                      )}
                      <CollapseToggle
                        isCollapsed={!isExpanded}
                        onToggle={() => toggleExpandedState(key)}
                        data-testid="rule-collapse-toggle"
                      />
                    </td>
                    <td>{promRule && isAlertingRule(promRule) ? <StateTag status={promRule.state} /> : 'n/a'}</td>
                    <td>{rule.name}</td>
                    {showGroupColumn && (
                      <td>{isCloudRulesSource(rulesSource) ? `${namespace.name} > ${group.name}` : namespace.name}</td>
                    )}
                    <td>{statuses.join(', ') || 'n/a'}</td>
                    <td className={tableStyles.actionsCell}>
                      {isCloudRulesSource(rulesSource) && (
                        <ActionIcon
                          icon="chart-line"
                          tooltip="view in explore"
                          target="__blank"
                          href={createExploreLink(rulesSource.name, rule.query)}
                        />
                      )}
                      {!!rulerRule && (
                        <ActionIcon
                          icon="pen"
                          tooltip="edit rule"
                          href={`alerting/${encodeURIComponent(
                            stringifyRuleIdentifier(
                              getRuleIdentifier(getRulesSourceName(rulesSource), namespace.name, group.name, rulerRule)
                            )
                          )}/edit`}
                        />
                      )}
                      {!!rulerRule && (
                        <ActionIcon icon="trash-alt" tooltip="delete rule" onClick={() => setRuleToDelete(rule)} />
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={ruleIdx % 2 === 0 ? tableStyles.evenRow : undefined}>
                      <td className={styles.relative}>
                        {!(ruleIdx === rules.length - 1) && showGuidelines && (
                          <div className={cx(styles.ruleContentGuideline, styles.guideline)} />
                        )}
                      </td>
                      <td colSpan={showGroupColumn ? 5 : 4}>
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
  wrapperMargin: css`
    margin-left: 36px;
  `,
  wrapper: css`
    margin-top: ${theme.spacing.md};
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
});
