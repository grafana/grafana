import { css, cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { useHasRuler } from '../../hooks/useHasRuler';
import { Annotation } from '../../utils/constants';
import { isGrafanaRulerRule } from '../../utils/rules';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { ProvisioningBadge } from '../Provisioning';
import { RuleLocation } from '../RuleLocation';

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
    return columns;
  }, [hasRuler, showSummaryColumn, showGroupColumn]);
}
