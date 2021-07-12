import React, { useCallback, useEffect, useMemo } from 'react';
import { useObservable } from 'react-use';
import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import {
  withErrorBoundary,
  useStyles2,
  Alert,
  LoadingPlaceholder,
  PanelChromeLoadingIndicator,
  Icon,
} from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';
import { RuleState } from './components/rules/RuleState';
import { getRulesSourceByName } from './utils/datasource';
import { DetailsField } from './components/DetailsField';
import { RuleHealth } from './components/rules/RuleHealth';
import { RuleViewerVisualization } from './components/rule-viewer/RuleViewerVisualization';
import { RuleDetailsActionButtons } from './components/rules/RuleDetailsActionButtons';
import { RuleDetailsMatchingInstances } from './components/rules/RuleDetailsMatchingInstances';
import { RuleDetailsDataSources } from './components/rules/RuleDetailsDataSources';
import { RuleViewerLayout, RuleViewerLayoutContent } from './components/rule-viewer/RuleViewerLayout';
import { AlertLabels } from './components/AlertLabels';
import { RuleDetailsExpression } from './components/rules/RuleDetailsExpression';
import { RuleDetailsAnnotations } from './components/rules/RuleDetailsAnnotations';
import * as ruleId from './utils/rule-id';

type RuleViewerProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;

const errorMessage = 'Could not find data source for rule';
const errorTitle = 'Could not view rule';
const pageTitle = 'Alerting / View rule';

export function RuleViewer({ match }: RuleViewerProps) {
  const styles = useStyles2(getStyles);
  const { id, sourceName } = match.params;
  const identifier = ruleId.tryParse(id, true);
  const { loading, error, result: rule } = useCombinedRule(identifier, sourceName);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());
  const queries = useMemo(() => alertRuleToQueries(rule), [rule]);

  const onRunQueries = useCallback(() => {
    if (queries.length > 0) {
      runner.run(queries);
    }
  }, [queries, runner]);

  useEffect(() => {
    onRunQueries();
  }, [onRunQueries]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  if (!sourceName) {
    return (
      <RuleViewerLayout title={pageTitle}>
        <Alert title={errorTitle}>
          <details className={styles.errorMessage}>{errorMessage}</details>
        </Alert>
      </RuleViewerLayout>
    );
  }

  const rulesSource = getRulesSourceByName(sourceName);

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
  return (
    <RuleViewerLayout wrapInContent={false} title={pageTitle}>
      <RuleViewerLayoutContent>
        <div>
          <h4>
            <Icon name="bell" size="lg" /> {rule.name}
          </h4>
          <RuleState rule={rule} isCreating={false} isDeleting={false} />
          <RuleDetailsActionButtons rule={rule} rulesSource={rulesSource} />
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
            <DetailsField label="Namespace / Group">{`${rule.namespace.name} / ${rule.group.name}`}</DetailsField>
          </div>
        </div>
        <div>
          <RuleDetailsMatchingInstances promRule={rule.promRule} />
        </div>
      </RuleViewerLayoutContent>
      {data && Object.keys(data).length > 0 && (
        <>
          <div className={styles.queriesTitle}>
            Query results <PanelChromeLoadingIndicator loading={isLoading(data)} onCancel={() => runner.cancel()} />
          </div>
          <RuleViewerLayoutContent padding={0}>
            <div className={styles.queries}>
              {queries.map((query) => {
                return (
                  <div key={query.refId} className={styles.query}>
                    <RuleViewerVisualization query={query} data={data && data[query.refId]} />
                  </div>
                );
              })}
            </div>
          </RuleViewerLayoutContent>
        </>
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
