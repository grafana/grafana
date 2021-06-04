import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { useObservable } from 'react-use';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PageToolbar, withErrorBoundary, useStyles2, HorizontalGroup, Alert } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';
import { RuleState } from './components/rules/RuleState';
import { TABLE, TIMESERIES } from './utils/constants';
import { isExpressionQuery } from '../../expressions/guards';
import { ruleIdentifierFromParam } from './utils/rules';
import { RuleDetails } from './components/rules/RuleDetails';
import { getRulesSourceByName } from './utils/datasource';
import { CombinedRule } from 'app/types/unified-alerting';
import { DetailsField } from './components/DetailsField';
import { RuleHealth } from './components/rules/RuleHealth';
import { AlertQueryVisualization } from './components/rule-viewer/AlertQueryVisualization';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;
const dataSourceError = 'Could not find data source for rule';

const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const styles = useStyles2(getStyles);
  const { id, sourceName } = match.params;
  const identifier = ruleIdentifierFromParam(id);
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
    return renderError(dataSourceError, styles);
  }

  const rulesSource = getRulesSourceByName(sourceName);

  if (loading) {
    return (
      <Page>
        <div className={styles.contentWithoutToolbar}>
          <div className={styles.details}>Loading rule...</div>
        </div>
      </Page>
    );
  }

  if (error || !rulesSource) {
    const message = error?.message || dataSourceError;
    return renderError(message, styles, error?.stack);
  }

  if (!rule) {
    return (
      <Page>
        <div className={styles.contentWithoutToolbar}>
          <div className={styles.details}>Rule could not be found</div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageToolbar title={`${ruleGroup(rule)} / ${rule.name}`} pageIcon="bell" />
      <div className={styles.content}>
        <div className={styles.details}>
          <div>
            <RuleState rule={rule} isCreating={false} isDeleting={false} />
          </div>
          <div>
            <RuleDetails rulesSource={rulesSource} rule={rule} />
            {rule.promRule && (
              <DetailsField label="Health" horizontal={true}>
                <RuleHealth rule={rule.promRule} />
              </DetailsField>
            )}
          </div>
        </div>
        {data && Object.keys(data).length > 0 && (
          <>
            <HorizontalGroup height="50px">
              <div className={styles.label}>Query results</div>
            </HorizontalGroup>
            <div className={styles.queries}>
              {queries.map((query) => {
                return (
                  <div key={query.refId} className={styles.section}>
                    <AlertQueryVisualization
                      query={query}
                      data={data && data[query.refId]}
                      defaultPanel={isExpressionQuery(query.model) ? TABLE : TIMESERIES}
                      runner={runner}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Page>
  );
};

function ruleGroup(rule: CombinedRule): string {
  if (rule.name === rule.group.name) {
    return rule.namespace.name;
  }
  return `${rule.namespace.name} / ${rule.group.name}`;
}

function renderError(message: string, styles: ReturnType<typeof getStyles>, stack?: string): JSX.Element | null {
  return (
    <Page>
      <div className={styles.contentWithoutToolbar}>
        <div className={styles.details}>
          <Alert title="Could not display rule">
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {message}
              <br />
              {stack ?? null}
            </details>
          </Alert>
        </div>
      </div>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css`
      margin: ${theme.spacing(0, 2, 2)};
    `,
    contentWithoutToolbar: css`
      margin: ${theme.spacing(7, 2, 2)};
    `,
    section: css`
      margin: ${theme.spacing(0, 0, 2)};
    `,
    details: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      padding: ${theme.spacing(2)};
    `,
    queries: css`
      height: 100%;
      width: 100%;
    `,
    label: css`
      padding: ${theme.spacing(0, 0.5)};
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      font-family: ${theme.typography.h5.fontFamily};
    `,
  };
};

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
