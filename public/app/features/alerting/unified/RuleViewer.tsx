import { css } from '@emotion/css';
import produce from 'immer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable, useToggle } from 'react-use';

import { GrafanaTheme2, LoadingState, PanelData, RelativeTimeRange } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import {
  Alert,
  Button,
  Collapse,
  Icon,
  IconButton,
  LoadingPlaceholder,
  useStyles2,
  VerticalGroup,
  withErrorBoundary,
} from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../core/constants';
import { AlertQuery, GrafanaRuleDefinition } from '../../../types/unified-alerting-dto';

import { GrafanaRuleQueryViewer, QueryPreview } from './GrafanaRuleQueryViewer';
import { AlertLabels } from './components/AlertLabels';
import { DetailsField } from './components/DetailsField';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { RuleViewerLayout, RuleViewerLayoutContent } from './components/rule-viewer/RuleViewerLayout';
import { RuleDetailsActionButtons } from './components/rules/RuleDetailsActionButtons';
import { RuleDetailsAnnotations } from './components/rules/RuleDetailsAnnotations';
import { RuleDetailsDataSources } from './components/rules/RuleDetailsDataSources';
import { RuleDetailsExpression } from './components/rules/RuleDetailsExpression';
import { RuleDetailsFederatedSources } from './components/rules/RuleDetailsFederatedSources';
import { RuleDetailsMatchingInstances } from './components/rules/RuleDetailsMatchingInstances';
import { RuleHealth } from './components/rules/RuleHealth';
import { RuleState } from './components/rules/RuleState';
import { useAlertQueriesStatus } from './hooks/useAlertQueriesStatus';
import { useCombinedRule } from './hooks/useCombinedRule';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCleanAnnotations } from './utils/annotations';
import { getRulesSourceByName } from './utils/datasource';
import { alertRuleToQueries } from './utils/query';
import * as ruleId from './utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from './utils/rules';

type RuleViewerProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;

const errorMessage = 'Could not find data source for rule';
const errorTitle = 'Could not view rule';
const pageTitle = 'View rule';

export function RuleViewer({ match }: RuleViewerProps) {
  const styles = useStyles2(getStyles);
  const [expandQuery, setExpandQuery] = useToggle(false);

  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  const { loading, error, result: rule } = useCombinedRule(identifier, identifier?.ruleSourceName);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());
  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);
  const annotations = useCleanAnnotations(rule?.annotations || {});

  const [evaluationTimeRanges, setEvaluationTimeRanges] = useState<Record<string, RelativeTimeRange>>({});

  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0 && allDataSourcesAvailable) {
      const evalCustomizedQueries = queries.map<AlertQuery>((q) => ({
        ...q,
        relativeTimeRange: evaluationTimeRanges[q.refId] ?? q.relativeTimeRange,
      }));

      runner.run(evalCustomizedQueries);
    }
  }, [queries, evaluationTimeRanges, runner, allDataSourcesAvailable]);

  useEffect(() => {
    const alertQueries = alertRuleToQueries(rule);
    const defaultEvalTimeRanges = Object.fromEntries(
      alertQueries.map((q) => [q.refId, q.relativeTimeRange ?? { from: 0, to: 0 }])
    );

    setEvaluationTimeRanges(defaultEvalTimeRanges);
  }, [rule]);

  useEffect(() => {
    if (allDataSourcesAvailable && expandQuery) {
      onRunQueries();
    }
  }, [onRunQueries, allDataSourcesAvailable, expandQuery]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  const onQueryTimeRangeChange = useCallback(
    (refId: string, timeRange: RelativeTimeRange) => {
      const newEvalTimeRanges = produce(evaluationTimeRanges, (draft) => {
        draft[refId] = timeRange;
      });
      setEvaluationTimeRanges(newEvalTimeRanges);
    },
    [evaluationTimeRanges, setEvaluationTimeRanges]
  );

  if (!identifier?.ruleSourceName) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title={errorTitle}>
          <details className={styles.errorMessage}>{errorMessage}</details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  const rulesSource = getRulesSourceByName(identifier.ruleSourceName);

  if (loading) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <LoadingPlaceholder text="Loading rule..." />
      </RuleViewerLayout>
    );
  }

  if (error || !rulesSource) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title={errorTitle}>
          <details className={styles.errorMessage}>
            {error?.message ?? errorMessage}
            <br />
            {!!error?.stack && error.stack}
          </details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  if (!rule) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <span>Rule could not be found.</span>
      </RuleViewerLayout>
    );
  }

  const isFederatedRule = isFederatedRuleGroup(rule.group);
  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);

  return (
    <RuleViewerLayout wrapInContent={false} title={pageTitle}>
      {isFederatedRule && (
        <Alert severity="info" title="This rule is part of a federated rule group.">
          <VerticalGroup>
            Federated rule groups are currently an experimental feature.
            <Button fill="text" icon="book">
              <a href="https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation">
                Read documentation
              </a>
            </Button>
          </VerticalGroup>
        </Alert>
      )}
      {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.AlertRule} />}
      <RuleViewerLayoutContent>
        <div>
          <Stack direction="row" alignItems="center" wrap={false} gap={1}>
            <Icon name="bell" size="lg" /> <span className={styles.title}>{rule.name}</span>
          </Stack>
          <RuleState rule={rule} isCreating={false} isDeleting={false} />
          <RuleDetailsActionButtons rule={rule} rulesSource={rulesSource} isViewMode={true} />
        </div>
        <div className={styles.details}>
          <div className={styles.leftSide}>
            {rule.promRule && (
              <DetailsField label="Health" horizontal={true}>
                <RuleHealth rule={rule.promRule} />
              </DetailsField>
            )}
            {!!rule.labels && !!Object.keys(rule.labels).length && (
              <DetailsField label="Labels" horizontal={true}>
                <AlertLabels labels={rule.labels} className={styles.labels} />
              </DetailsField>
            )}
            <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
            <RuleDetailsAnnotations annotations={annotations} />
          </div>
          <div className={styles.rightSide}>
            <RuleDetailsDataSources rule={rule} rulesSource={rulesSource} />
            {isFederatedRule && <RuleDetailsFederatedSources group={rule.group} />}
            <DetailsField label="Namespace / Group" className={styles.rightSideDetails}>
              {rule.namespace.name} / {rule.group.name}
            </DetailsField>
            {isGrafanaRulerRule(rule.rulerRule) && <GrafanaRuleUID rule={rule.rulerRule.grafana_alert} />}
          </div>
        </div>
        <div>
          <RuleDetailsMatchingInstances
            rule={rule}
            pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }}
            enableFiltering
          />
        </div>
      </RuleViewerLayoutContent>
      <Collapse
        label="Query & Results"
        isOpen={expandQuery}
        onToggle={setExpandQuery}
        loading={data && isLoading(data)}
        collapsible={true}
        className={styles.collapse}
      >
        {isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && (
          <GrafanaRuleQueryViewer
            condition={rule.rulerRule.grafana_alert.condition}
            queries={queries}
            evalDataByQuery={data}
            evalTimeRanges={evaluationTimeRanges}
            onTimeRangeChange={onQueryTimeRangeChange}
          />
        )}

        {!isGrafanaRulerRule(rule.rulerRule) && !isFederatedRule && data && Object.keys(data).length > 0 && (
          <div className={styles.queries}>
            {queries.map((query) => {
              return (
                <QueryPreview
                  key={query.refId}
                  refId={query.refId}
                  model={query.model}
                  dataSource={Object.values(config.datasources).find((ds) => ds.uid === query.datasourceUid)}
                  queryData={data[query.refId]}
                  relativeTimeRange={query.relativeTimeRange}
                  evalTimeRange={evaluationTimeRanges[query.refId]}
                  onEvalTimeRangeChange={(timeRange) => onQueryTimeRangeChange(query.refId, timeRange)}
                  isAlertCondition={false}
                />
              );
            })}
          </div>
        )}
        {!isFederatedRule && !allDataSourcesAvailable && (
          <Alert title="Query not available" severity="warning" className={styles.queryWarning}>
            Cannot display the query preview. Some of the data sources used in the queries are not available.
          </Alert>
        )}
      </Collapse>
    </RuleViewerLayout>
  );
}

function GrafanaRuleUID({ rule }: { rule: GrafanaRuleDefinition }) {
  const styles = useStyles2(getStyles);
  const copyUID = () => navigator.clipboard && navigator.clipboard.writeText(rule.uid);

  return (
    <DetailsField label="Rule UID" childrenWrapperClassName={styles.ruleUid}>
      {rule.uid} <IconButton name="copy" onClick={copyUID} tooltip="Copy rule" />
    </DetailsField>
  );
}

function isLoading(data: Record<string, PanelData>): boolean {
  return !!Object.values(data).find((d) => d.state === LoadingState.Loading);
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    errorMessage: css`
      white-space: pre-wrap;
    `,
    queries: css`
      height: 100%;
      width: 100%;
    `,
    collapse: css`
      margin-top: ${theme.spacing(2)};
      border-color: ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
    `,
    queriesTitle: css`
      padding: ${theme.spacing(2, 0.5)};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      font-family: ${theme.typography.h5.fontFamily};
    `,
    query: css`
      border-bottom: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing(2)};
    `,
    queryWarning: css`
      margin: ${theme.spacing(4, 0)};
    `,
    title: css`
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.fontWeightBold};

      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `,
    details: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(4)};
    `,
    leftSide: css`
      flex: 1;
    `,
    rightSide: css`
      padding-right: ${theme.spacing(3)};

      max-width: 360px;
      word-break: break-all;
      overflow: hidden;
    `,
    rightSideDetails: css`
      & > div:first-child {
        width: auto;
      }
    `,
    labels: css`
      justify-content: flex-start;
    `,
    ruleUid: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
  };
};

export default withErrorBoundary(RuleViewer, { style: 'page' });
