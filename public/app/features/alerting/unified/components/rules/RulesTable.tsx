import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Tooltip } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { useHasRuler } from '../../hooks/useHasRuler';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { Annotation } from '../../utils/constants';
import { getRulePluginOrigin, isGrafanaRulerRule, isGrafanaRulerRulePaused } from '../../utils/rules';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { DynamicTableWithGuidelines } from '../DynamicTableWithGuidelines';
import { ProvisioningBadge } from '../Provisioning';
import { RuleLocation } from '../RuleLocation';
import { Tokenize } from '../Tokenize';
import { calculateNextEvaluationEstimate } from '../rule-list/util';

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
  showNextEvaluationColumn?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const RulesTable = ({
  rules,
  className,
  showGuidelines = false,
  emptyMessage = 'No rules found.',
  showGroupColumn = false,
  showSummaryColumn = false,
  showNextEvaluationColumn = false,
}: Props) => {
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

  const columns = useColumns(showSummaryColumn, showGroupColumn, showNextEvaluationColumn);

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
  wrapperMargin: css({
    [theme.breakpoints.up('md')]: {
      marginLeft: '36px',
    },
  }),
  emptyMessage: css({
    padding: theme.spacing(1),
  }),
  wrapper: css({
    width: 'auto',
    borderRadius: theme.shape.radius.default,
  }),
  pagination: css({
    display: 'flex',
    margin: 0,
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(0.25),
    justifyContent: 'center',
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    borderRight: `1px solid ${theme.colors.border.medium}`,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
});

function useColumns(showSummaryColumn: boolean, showGroupColumn: boolean, showNextEvaluationColumn: boolean) {
  const { hasRuler, rulerRulesLoaded } = useHasRuler();

  return useMemo((): RuleTableColumnProps[] => {
    const ruleIsDeleting = (rule: CombinedRule) => {
      const { namespace, promRule, rulerRule } = rule;
      const { rulesSource } = namespace;
      return Boolean(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && promRule && !rulerRule);
    };

    const ruleIsCreating = (rule: CombinedRule) => {
      const { namespace, promRule, rulerRule } = rule;
      const { rulesSource } = namespace;
      return Boolean(hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && rulerRule && !promRule);
    };

    const columns: RuleTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        renderCell: ({ data: rule }) => {
          const isDeleting = ruleIsDeleting(rule);
          const isCreating = ruleIsCreating(rule);
          const isPaused = isGrafanaRulerRule(rule.rulerRule) && isGrafanaRulerRulePaused(rule.rulerRule);

          return <RuleState rule={rule} isDeleting={isDeleting} isCreating={isCreating} isPaused={isPaused} />;
        },
        size: '165px',
      },
      {
        id: 'name',
        label: 'Name',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => rule.name,
        size: showNextEvaluationColumn ? 4 : 5,
      },
      {
        id: 'metadata',
        label: '',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: rule }) => {
          const rulerRule = rule.rulerRule;

          const originMeta = getRulePluginOrigin(rule);
          if (originMeta) {
            return <PluginOriginBadge pluginId={originMeta.pluginId} />;
          }

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
        size: showNextEvaluationColumn ? 4 : 5,
      });
    }

    if (showNextEvaluationColumn) {
      columns.push({
        id: 'nextEvaluation',
        label: 'Next evaluation',
        renderCell: ({ data: rule }) => {
          const nextEvalInfo = calculateNextEvaluationEstimate(rule.promRule?.lastEvaluation, rule.group.interval);

          return (
            nextEvalInfo && (
              <Tooltip placement="top" content={`${nextEvalInfo?.fullDate}`} theme="info">
                <span>{nextEvalInfo?.humanized}</span>
              </Tooltip>
            )
          );
        },
        size: 2,
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
        const isDeleting = ruleIsDeleting(rule);
        const isCreating = ruleIsCreating(rule);
        return (
          <RuleActionsButtons
            compact
            showViewButton={!isDeleting && !isCreating}
            rule={rule}
            rulesSource={rule.namespace.rulesSource}
          />
        );
      },
      size: '200px',
    });

    return columns;
  }, [showSummaryColumn, showGroupColumn, showNextEvaluationColumn, hasRuler, rulerRulesLoaded]);
}
