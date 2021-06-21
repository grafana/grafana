import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React, { FC, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { RuleDetails } from './RuleDetails';
import { isCloudRulesSource } from '../../utils/datasource';
import { useHasRuler } from '../../hooks/useHasRuler';
import { CombinedRule } from 'app/types/unified-alerting';
import { Annotation } from '../../utils/constants';
import { RuleState } from './RuleState';
import { RuleHealth } from './RuleHealth';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

type RuleTableColumnProps = DynamicTableColumnProps<CombinedRule>;
type RuleTableItemProps = DynamicTableItemProps<CombinedRule>;

interface Props {
  rules: CombinedRule[];
  showGuidelines?: boolean;
  showGroupColumn?: boolean;
  showSummaryColumn?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const RulesTable: FC<Props> = ({
  rules,
  className,
  showGuidelines = false,
  emptyMessage = 'No rules found.',
  showGroupColumn = false,
  showSummaryColumn = false,
}) => {
  const styles = useStyles2(getStyles);
  const columns = useColumns(showSummaryColumn, showGroupColumn);

  const wrapperClass = cx(styles.wrapper, className, { [styles.wrapperMargin]: showGuidelines });

  const items = useMemo((): RuleTableItemProps[] => {
    const seenKeys: string[] = [];
    return rules.map((rule, ruleIdx) => {
      let key = JSON.stringify([rule.promRule?.type, rule.labels, rule.query, rule.name, rule.annotations]);
      if (seenKeys.includes(key)) {
        key += `-${ruleIdx}`;
      }
      seenKeys.push(key);
      return {
        id: key,
        data: rule,
      };
    });
  }, [rules]);

  if (!rules.length) {
    return <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>;
  }

  return (
    <div className={wrapperClass}>
      <DynamicTable
        cols={columns}
        isExpandable={true}
        items={items}
        renderExpandedContent={({ data: rule }) => <RuleDetails rule={rule} />}
      />
    </div>
  );

  /*
  return (
    <div className={wrapperClass}>
      <table className={tableStyles.table} data-testid="rules-table">
        <colgroup>
          <col className={tableStyles.colExpand} />
          <col className={styles.state} />
          <col />
          <col />
          {showSummaryColumn && <col />}
          {showGroupColumn && <col />}
        </colgroup>
        <thead>
          <tr>
            <th className={styles.relative}>
              {showGuidelines && <div className={cx(styles.headerGuideline, styles.guideline)} />}
            </th>
            <th>State</th>
            <th>Name</th>
            <th>Health</th>
            {showSummaryColumn && <th>Summary</th>}
            {showGroupColumn && <th>Group</th>}
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
              const isDeleting = !!(hasRuler(rulesSource) && promRule && !rulerRule);
              const isCreating = !!(hasRuler(rulesSource) && rulerRule && !promRule);

              let detailsColspan = 3;
              if (showGroupColumn) {
                detailsColspan += 1;
              }
              if (showSummaryColumn) {
                detailsColspan += 1;
              }
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
                    <td>
                      <RuleState rule={rule} isDeleting={isDeleting} isCreating={isCreating} />
                    </td>
                    <td>{rule.name}</td>
                    <td>{promRule && <RuleHealth rule={promRule} />}</td>
                    {showSummaryColumn && <td>{rule.annotations[Annotation.summary] ?? ''}</td>}
                    {showGroupColumn && (
                      <td>{isCloudRulesSource(rulesSource) ? `${namespace.name} > ${group.name}` : namespace.name}</td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className={ruleIdx % 2 === 0 ? tableStyles.evenRow : undefined}>
                      <td className={styles.relative}>
                        {!(ruleIdx === rules.length - 1) && showGuidelines && (
                          <div className={cx(styles.ruleContentGuideline, styles.guideline)} />
                        )}
                      </td>
                      <td colSpan={detailsColspan}>
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
    </div>
  );
    */
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapperMargin: css`
    ${theme.breakpoints.up('md')} {
      margin-left: 36px;
    }
  `,
  emptyMessage: css`
    padding: ${theme.spacing(1)};
  `,
  wrapper: css`
    width: auto;
    background-color: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.borderRadius()};
  `,
  table: css`
    width: 100%;
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};

    th {
      padding: ${theme.spacing(1)};
    }

    td + td {
      padding: ${theme.spacing(0, 1)};
    }

    tr {
      height: 38px;
    }
  `,
  evenRow: css`
    background-color: ${theme.colors.background.primary};
  `,
  relative: css`
    position: relative;
  `,
  guideline: css`
    left: -19px;
    border-left: 1px solid ${theme.colors.border.medium};
    position: absolute;

    ${theme.breakpoints.down('md')} {
      display: none;
    }
  `,
  ruleTopGuideline: css`
    width: 18px;
    border-bottom: 1px solid ${theme.colors.border.medium};
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
  state: css`
    width: 110px;
  `,
});

function useColumns(showSummaryColumn: boolean, showGroupColumn: boolean) {
  const hasRuler = useHasRuler();

  return useMemo((): RuleTableColumnProps[] => {
    const columns: RuleTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => {
          const { namespace } = rule;
          const { rulesSource } = namespace;
          const { promRule, rulerRule } = rule;
          const isDeleting = !!(hasRuler(rulesSource) && promRule && !rulerRule);
          const isCreating = !!(hasRuler(rulesSource) && rulerRule && !promRule);
          return <RuleState rule={rule} isDeleting={isDeleting} isCreating={isCreating} />;
        },
        size: '165px',
      },
      {
        id: 'name',
        label: 'Name',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => rule.name,
        size: 5,
      },
      {
        id: 'health',
        label: 'Health',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { promRule } }) => (promRule ? <RuleHealth rule={promRule} /> : null),
        size: '75px',
      },
    ];
    if (showSummaryColumn) {
      columns.push({
        id: 'summary',
        label: 'Summary',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => rule.annotations[Annotation.summary] ?? '',
        size: 5,
      });
    }
    if (showGroupColumn) {
      columns.push({
        id: 'group',
        label: 'Group',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => {
          const { namespace, group } = rule;
          const { rulesSource } = namespace;
          return isCloudRulesSource(rulesSource) ? `${namespace.name} > ${group.name}` : namespace.name;
        },
        size: 5,
      });
    }
    return columns;
  }, [hasRuler, showSummaryColumn, showGroupColumn]);
}
