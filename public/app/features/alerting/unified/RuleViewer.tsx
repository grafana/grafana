import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import {
  Alert,
  Button,
  Icon,
  LoadingPlaceholder,
  PanelChromeLoadingIndicator,
  useStyles2,
  VerticalGroup,
  withErrorBoundary,
} from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../core/constants';
import { AlertQuery } from '../../../types/unified-alerting-dto';

import { AlertLabels } from './components/AlertLabels';
import { DetailsField } from './components/DetailsField';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { RuleViewerLayout, RuleViewerLayoutContent } from './components/rule-viewer/RuleViewerLayout';
import { RuleViewerVisualization } from './components/rule-viewer/RuleViewerVisualization';
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
  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  const { loading, error, result: rule } = useCombinedRule(identifier, identifier?.ruleSourceName);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());
  const queries2 = useMemo(() => alertRuleToQueries(rule), [rule]);
  const [queries, setQueries] = useState<AlertQuery[]>([]);

  const { allDataSourcesAvailable } = useAlertQueriesStatus(queries2);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0 && allDataSourcesAvailable) {
      runner.run(queries);
    }
  }, [queries, runner, allDataSourcesAvailable]);

  useEffect(() => {
    setQueries(queries2);
  }, [queries2]);

  useEffect(() => {
    if (allDataSourcesAvailable) {
      onRunQueries();
    }
  }, [onRunQueries, allDataSourcesAvailable]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  const onChangeQuery = useCallback((query: AlertQuery) => {
    setQueries((queries) =>
      queries.map((q) => {
        if (q.refId === query.refId) {
          return query;
        }
        return q;
      })
    );
  }, []);

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

  const annotations = Object.entries(rule.annotations).filter(([_, value]) => !!value.trim());
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
          <h4>
            <Icon name="bell" size="lg" /> {rule.name}
          </h4>
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
                <AlertLabels labels={rule.labels} />
              </DetailsField>
            )}
            <RuleDetailsExpression rulesSource={rulesSource} rule={rule} annotations={annotations} />
            <RuleDetailsAnnotations annotations={annotations} />
          </div>
          <div className={styles.rightSide}>
            <RuleDetailsDataSources rule={rule} rulesSource={rulesSource} />
            {isFederatedRule && <RuleDetailsFederatedSources group={rule.group} />}
            <DetailsField label="Namespace / Group">{`${rule.namespace.name} / ${rule.group.name}`}</DetailsField>
          </div>
        </div>
        <div>
          <RuleDetailsMatchingInstances rule={rule} pagination={{ itemsPerPage: DEFAULT_PER_PAGE_PAGINATION }} />
        </div>
      </RuleViewerLayoutContent>
      {!isFederatedRule && data && Object.keys(data).length > 0 && (
        <>
          <div className={styles.queriesTitle}>
            Query results <PanelChromeLoadingIndicator loading={isLoading(data)} onCancel={() => runner.cancel()} />
          </div>
          <RuleViewerLayoutContent padding={0}>
            <div className={styles.queries}>
              {queries.map((query) => {
                return (
                  <div key={query.refId} className={styles.query}>
                    <RuleViewerVisualization
                      query={query}
                      data={data && data[query.refId]}
                      onChangeQuery={onChangeQuery}
                    />
                  </div>
                );
              })}
            </div>
          </RuleViewerLayoutContent>
        </>
      )}
      {!isFederatedRule && !allDataSourcesAvailable && (
        <Alert title="Query not available" severity="warning" className={styles.queryWarning}>
          Cannot display the query preview. Some of the data sources used in the queries are not available.
        </Alert>
      )}
    </RuleViewerLayout>
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
    details: css`
      display: flex;
      flex-direction: row;
    `,
    leftSide: css`
      flex: 1;
    `,
    rightSide: css`
      padding-left: 90px;
      width: 300px;
    `,
  };
};

export default withErrorBoundary(RuleViewer, { style: 'page' });
