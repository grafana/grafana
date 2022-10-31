import { css, cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { useHasRuler } from '../../hooks/useHasRuler';
import { Annotation } from '../../utils/constants';
import { isGrafanaRulerRule } from '../../utils/rules';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { ProvisioningBadge } from '../Provisioning';
import { RuleLocation } from '../RuleLocation';
import { Tokenize } from '../Tokenize';

import { RuleActionsButtons } from './RuleActionsButtons';
import { RuleConfigStatus } from './RuleConfigStatus';
import { RuleDetails } from './RuleDetails';
import { RuleHealth } from './RuleHealth';
import { RuleState } from './RuleState';

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
    return rules.map((rule, ruleIdx) => {
      return {
        id: `${rule.namespace.name}-${rule.group.name}-${rule.name}-${ruleIdx}`,
        data: rule,
      };
    });
  }, [rules]);

  const columns = useColumns(showSummaryColumn, showGroupColumn);

  if (!rules.length) {
    return <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>;
  }

  const TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;

  return (
    <div className={wrapperClass} data-testid="rules-table">
      <TableComponent
        cols={columns}
        isExpandable={true}
        items={items}
        renderExpandedContent={({ data: rule }) => <RuleDetails rule={rule} />}
        pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }}
        paginationStyles={styles.pagination}
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
    border-radius: ${theme.shape.borderRadius()};
  `,
  pagination: css`
    display: flex;
    margin: 0;
    padding-top: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.25)};
    justify-content: center;
    border-left: 1px solid ${theme.colors.border.strong};
    border-right: 1px solid ${theme.colors.border.strong};
    border-bottom: 1px solid ${theme.colors.border.strong};
  `,
});

function useColumns(showSummaryColumn: boolean, showGroupColumn: boolean) {
  const { hasRuler, rulerRulesLoaded } = useHasRuler();

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
          const isDeleting = !!(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && promRule && !rulerRule);
          const isCreating = !!(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && rulerRule && !promRule);
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
        id: 'provisioned',
        label: '',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => {
          const rulerRule = rule.rulerRule;
          const isGrafanaManagedRule = isGrafanaRulerRule(rulerRule);

          if (!isGrafanaManagedRule) {
            return null;
          }

          const provenance = rulerRule.grafana_alert.provenance;
          return provenance ? <ProvisioningBadge /> : null;
        },
        size: '100px',
      },
      {
        id: 'warnings',
        label: '',
        renderCell: ({ data: combinedRule }) => <RuleConfigStatus rule={combinedRule} />,
        size: '45px',
      },
      {
        id: 'health',
        label: 'Health',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: { promRule, group } }) => (promRule ? <RuleHealth rule={promRule} /> : null),
        size: '75px',
      },
    ];
    if (showSummaryColumn) {
      columns.push({
        id: 'summary',
        label: 'Summary',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => {
          return <Tokenize input={rule.annotations[Annotation.summary] ?? ''} />;
        },
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
          // ungrouped rules are rules that are in the "default" group name
          const isUngrouped = group.name === 'default';
          const groupName = isUngrouped ? (
            <RuleLocation namespace={namespace.name} />
          ) : (
            <RuleLocation namespace={namespace.name} group={group.name} />
          );

          return groupName;
        },
        size: 5,
      });
    }
    columns.push({
      id: 'actions',
      label: 'Actions',
      // eslint-disable-next-line react/display-name
      renderCell: ({ data: rule }) => {
        return <RuleActionsButtons rule={rule} rulesSource={rule.namespace.rulesSource} />;
      },
      size: '290px',
    });

    return columns;
  }, [showSummaryColumn, showGroupColumn, hasRuler, rulerRulesLoaded]);
}
