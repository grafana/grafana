import { css, cx } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, Pagination, Tooltip, useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { shouldUsePrometheusRulesPrimary } from '../../featureToggles';
import { useAsync } from '../../hooks/useAsync';
import { attachRulerRuleToCombinedRule } from '../../hooks/useCombinedRuleNamespaces';
import { useHasRuler } from '../../hooks/useHasRuler';
import { usePagination } from '../../hooks/usePagination';
import { PluginOriginBadge } from '../../plugins/PluginOriginBadge';
import { calculateNextEvaluationEstimate } from '../../rule-list/components/util';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { getRulePluginOrigin, isGrafanaRulerRule, isGrafanaRulerRulePaused } from '../../utils/rules';
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
  showNextEvaluationColumn?: boolean;
  emptyMessage?: string;
  className?: string;
}

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

const { useLazyGetRuleGroupForNamespaceQuery } = alertRuleApi;
const { useLazyDiscoverDsFeaturesQuery } = featureDiscoveryApi;

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

  const { pageItems, page, numberOfPages, onPageChange } = usePagination(rules, 1, DEFAULT_PER_PAGE_PAGINATION);

  const [lazyLoadRules, { result: rulesWithRulerDefinitions, status: rulerRulesLoadingStatus }] =
    useLazyLoadRulerRules(pageItems);
  const isLoadingRulerGroup = useMemo(
    () => !rulerRulesLoadingStatus || rulerRulesLoadingStatus === 'loading',
    [rulerRulesLoadingStatus]
  );

  useEffect(() => {
    if (pageItems.length > 0) {
      lazyLoadRules.execute();
    }
  }, [lazyLoadRules, pageItems, rulerRulesLoadingStatus]);

  const items = useMemo((): RuleTableItemProps[] => {
    return rulesWithRulerDefinitions.map((rule, ruleIdx) => {
      return {
        id: `${rule.namespace.name}-${rule.group.name}-${rule.name}-${ruleIdx}`,
        data: rule,
      };
    });
  }, [rulesWithRulerDefinitions]);

  const columns = useColumns(showSummaryColumn, showGroupColumn, showNextEvaluationColumn, isLoadingRulerGroup);

  if (!pageItems.length) {
    return <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>;
  }

  if (isLoadingRulerGroup) {
    return <LoadingPlaceholder text="Loading..." />;
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
      <Pagination
        currentPage={page}
        numberOfPages={numberOfPages}
        onNavigate={onPageChange}
        hideWhenSinglePage
        className={styles.pagination}
      />
    </div>
  );
};

/**
 * This hook is used to lazy load the Ruler rule for each rule.
 * If the `prometheusRulesPrimary` feature flag is enabled, the hook will fetch the Ruler rule counterpart for each Prometheus rule.
 * If the `prometheusRulesPrimary` feature flag is disabled, the hook will return the rules as is.
 * @param rules Combined rules with or without Ruler rule property
 * @returns Combined rules enriched with Ruler rule property
 */
function useLazyLoadRulerRules(rules: CombinedRule[]) {
  const [fetchRulerRuleGroup] = useLazyGetRuleGroupForNamespaceQuery();
  const [fetchDsFeatures] = useLazyDiscoverDsFeaturesQuery();

  return useAsync(async () => {
    if (!prometheusRulesPrimary) {
      return rules;
    }
    return Promise.all(
      rules.map(async (rule) => {
        const dsFeatures = await fetchDsFeatures(
          { rulesSourceName: getRulesSourceName(rule.namespace.rulesSource) },
          true
        ).unwrap();

        // Due to lack of ruleUid and folderUid in Prometheus rules we cannot do the lazy load for GMA
        if (dsFeatures.rulerConfig && rule.namespace.rulesSource !== GRAFANA_RULES_SOURCE_NAME) {
          // RTK Query should handle caching and deduplication for us
          const rulerRuleGroup = await fetchRulerRuleGroup(
            {
              namespace: rule.namespace.name,
              group: rule.group.name,
              rulerConfig: dsFeatures.rulerConfig,
            },
            true
          ).unwrap();

          attachRulerRuleToCombinedRule(rule, rulerRuleGroup);
        }

        return rule;
      })
    );
  }, rules);
}

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
  skeletonWrapper: css({
    flex: 1,
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
    float: 'none',
  }),
});

function useColumns(
  showSummaryColumn: boolean,
  showGroupColumn: boolean,
  showNextEvaluationColumn: boolean,
  isRulerLoading: boolean
) {
  return useMemo((): RuleTableColumnProps[] => {
    const columns: RuleTableColumnProps[] = [
      {
        id: 'state',
        label: 'State',
        renderCell: ({ data: rule }) => <RuleStateCell rule={rule} />,
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
      renderCell: ({ data: rule }) => <RuleActionsCell rule={rule} isLoadingRuler={isRulerLoading} />,
      size: '215px',
    });

    return columns;
  }, [showSummaryColumn, showGroupColumn, showNextEvaluationColumn, isRulerLoading]);
}

function RuleStateCell({ rule }: { rule: CombinedRule }) {
  const { isDeleting, isCreating, isPaused } = useRuleStatus(rule);
  return <RuleState rule={rule} isDeleting={isDeleting} isCreating={isCreating} isPaused={isPaused} />;
}

function RuleActionsCell({ rule, isLoadingRuler }: { rule: CombinedRule; isLoadingRuler: boolean }) {
  const styles = useStyles2(getStyles);
  const { isDeleting, isCreating } = useRuleStatus(rule);

  if (isLoadingRuler) {
    return <Skeleton containerClassName={styles.skeletonWrapper} />;
  }

  return (
    <RuleActionsButtons
      compact
      showViewButton={!isDeleting && !isCreating}
      rule={rule}
      rulesSource={rule.namespace.rulesSource}
    />
  );
}

function useRuleStatus(rule: CombinedRule) {
  const { hasRuler, rulerRulesLoaded } = useHasRuler(rule.namespace.rulesSource);
  const { promRule, rulerRule } = rule;

  // If prometheusRulesPrimary is enabled, we don't fetch rules from the Ruler API (except for Grafana managed rules)
  // so there is no way to detect statuses
  if (prometheusRulesPrimary && !isGrafanaRulerRule(rulerRule)) {
    return { isDeleting: false, isCreating: false, isPaused: false };
  }

  const isDeleting = Boolean(hasRuler && rulerRulesLoaded && promRule && !rulerRule);
  const isCreating = Boolean(hasRuler && rulerRulesLoaded && rulerRule && !promRule);
  const isPaused = isGrafanaRulerRule(rulerRule) && isGrafanaRulerRulePaused(rulerRule);

  return { isDeleting, isCreating, isPaused };
}
