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

  const columns = useColumns(showSummaryColumn, showGroupColumn, showGuidelines, items.length);

  if (!rules.length) {
    return <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>;
  }

  return (
    <div className={wrapperClass} data-testid="rules-table">
      <DynamicTable
        cols={columns}
        isExpandable={true}
        items={items}
        renderExpandedContent={({ data: rule }, index) => (
          <>
            {!(index === rules.length - 1) && showGuidelines ? (
              <div className={cx(styles.ruleContentGuideline, styles.guideline)} />
            ) : null}
            <RuleDetails rule={rule} />
          </>
        )}
        renderPrefixHeader={
          showGuidelines
            ? () => (
                <div className={styles.relative}>
                  <div className={cx(styles.headerGuideline, styles.guideline)} />
                </div>
              )
            : undefined
        }
        renderPrefixCell={
          showGuidelines
            ? (_, index) => (
                <div className={styles.relative}>
                  <div className={cx(styles.ruleTopGuideline, styles.guideline)} />
                  {!(index === rules.length - 1) && (
                    <div className={cx(styles.ruleBottomGuideline, styles.guideline)} />
                  )}
                </div>
              )
            : undefined
        }
      />
    </div>
  );
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
    height: 100%;
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
    left: -49px !important;
  `,
  headerGuideline: css`
    top: -24px;
    bottom: 0;
  `,
  state: css`
    width: 110px;
  `,
});

function useColumns(showSummaryColumn: boolean, showGroupColumn: boolean, showGuidelines: boolean, totalRules: number) {
  const hasRuler = useHasRuler();
  const styles = useStyles2(getStyles);

  return useMemo((): RuleTableColumnProps[] => {
    const columns: RuleTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }, ruleIdx) => {
          const { namespace } = rule;
          const { rulesSource } = namespace;
          const { promRule, rulerRule } = rule;
          const isDeleting = !!(hasRuler(rulesSource) && promRule && !rulerRule);
          const isCreating = !!(hasRuler(rulesSource) && rulerRule && !promRule);
          return (
            <>
              {showGuidelines && (
                <>
                  <div className={cx(styles.ruleTopGuideline, styles.guideline)} />
                  {!(ruleIdx === totalRules - 1) && (
                    <div className={cx(styles.ruleBottomGuideline, styles.guideline)} />
                  )}
                </>
              )}
              <RuleState rule={rule} isDeleting={isDeleting} isCreating={isCreating} />
            </>
          );
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
  }, [hasRuler, showSummaryColumn, showGroupColumn, showGuidelines, totalRules, styles]);
}
