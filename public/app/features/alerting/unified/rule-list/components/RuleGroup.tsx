import { useEffect } from 'react';
import { useMeasure, useToggle } from 'react-use';

import { Alert, LoadingBar, Pagination } from '@grafana/ui';
import { RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { usePagination } from '../../hooks/usePagination';
import { isAlertingRule } from '../../utils/rules';

import { AlertRuleListItem } from './AlertRuleListItem';
import { EvaluationGroup } from './EvaluationGroup';
import { SkeletonListItem } from './ListItem';

interface EvaluationGroupLoaderProps {
  name: string;
  interval?: string;
  provenance?: string;
  namespace: string;
  rulerConfig?: RulerDataSourceConfig;
}

const ALERT_RULE_PAGE_SIZE = 15;

export const EvaluationGroupLoader = ({
  name,
  provenance,
  interval,
  namespace,
  rulerConfig,
}: EvaluationGroupLoaderProps) => {
  const [isOpen, toggle] = useToggle(false);

  // TODO use Prometheus endpoint here?
  const [fetchRulerRuleGroup, { currentData: promNamespace, isLoading, error }] =
    alertRuleApi.endpoints.prometheusRuleNamespaces.useLazyQuery();

  const promRules = promNamespace?.flatMap((namespace) => namespace.groups).flatMap((groups) => groups.rules);
  const { page, pageItems, onPageChange, numberOfPages } = usePagination(promRules ?? [], 1, ALERT_RULE_PAGE_SIZE);

  useEffect(() => {
    if (isOpen && rulerConfig) {
      fetchRulerRuleGroup({
        namespace,
        groupName: name,
        ruleSourceName: rulerConfig.dataSourceName,
      });
    }
  }, [fetchRulerRuleGroup, isOpen, name, namespace, rulerConfig]);

  return (
    <EvaluationGroup name={name} interval={interval} provenance={provenance} isOpen={isOpen} onToggle={toggle}>
      {/* @TODO nicer error handling */}
      {error ? (
        <Alert title="Something went wrong when trying to fetch group details">{String(error)}</Alert>
      ) : (
        <>
          {isLoading ? (
            <GroupLoadingIndicator />
          ) : (
            pageItems.map((rule, index) => {
              <AlertRuleListItem
                key={index}
                state={PromAlertingRuleState.Inactive}
                name={rule.name}
                href={'/'}
                summary={isAlertingRule(rule) ? rule.annotations?.summary : undefined}
              />;

              return null;
            })
          )}
          {numberOfPages > 1 && (
            <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} />
          )}
        </>
      )}
    </EvaluationGroup>
  );
};

export const LoadingIndicator = ({ datasourceUid }: { datasourceUid: string }) => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref} data-testid={`ds-loading-indicator-${datasourceUid}`}>
      <LoadingBar width={width} />
    </div>
  );
};

const GroupLoadingIndicator = () => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref}>
      <LoadingBar width={width} />
      <SkeletonListItem />
    </div>
  );
};
