import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { useObservable } from 'react-use';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, PageToolbar, withErrorBoundary, useStyles2, Field, TextArea, CodeEditor } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { parseRuleIdentifier } from './utils/rules';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useCombinedRule } from './hooks/useCombinedRule';
import { alertRuleToQueries } from './utils/query';
import { contextSrv } from 'app/core/core';
import { RuleState } from './components/rules/RuleState';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;
const isEditor = contextSrv.isEditor;
const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const { id, sourceName } = match.params;
  const identifier = getIdentifier(id);
  const { loading, error, result: rule } = useCombinedRule(identifier, sourceName);
  const styles = useStyles2(getStyles);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());

  const onRunQueries = useCallback(() => {
    const queries = alertRuleToQueries(rule);
    if (queries.length === 0) {
      return;
    }
    runner.run(queries);
  }, [runner, rule]);

  useEffect(() => {
    onRunQueries();
  }, [onRunQueries]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  if (!rule) {
    return <div>no alert rule</div>;
  }

  if (loading) {
    return <div>loading rule</div>;
  }

  if (error) {
    return <div>could not load rule due to error</div>;
  }

  console.log('rule', rule);
  console.log('data', data);

  return (
    <Page>
      <PageToolbar title={rule.group.name} pageIcon="bell">
        {isEditor ? (
          <Button variant="primary" type="button">
            Edit
          </Button>
        ) : null}
        {isEditor ? (
          <Button variant="destructive" type="button">
            Delete
          </Button>
        ) : null}
      </PageToolbar>
      <div className={styles.content}>
        <div className={styles.quickInfo}>
          <RuleState rule={rule} isCreating={false} isDeleting={false} />
        </div>
        <div className={styles.info}>
          {Object.entries(rule.annotations).map(([key, value], index) => {
            return (
              <Field label={key} key={`${key}-${index}`}>
                <TextArea value={value} readOnly cols={15} rows={2} />
              </Field>
            );
          })}
        </div>
        <div className={styles.queries}>
          <h4>Queries</h4>
          {rule &&
            rule.rulerRule &&
            rule.rulerRule.grafana_alert &&
            rule.rulerRule.grafana_alert.data.map((query, index) => {
              return (
                <div key={index} className={styles.query}>
                  <span>vis</span>
                  <CodeEditor
                    language="json"
                    readOnly
                    value={JSON.stringify(query.model, null, 2)}
                    height={200}
                    showMiniMap={false}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </Page>
  );
};

const getIdentifier = (id: string | undefined) => {
  if (!id) {
    return undefined;
  }
  return parseRuleIdentifier(decodeURIComponent(id));
};

const getStyles = (theme: GrafanaTheme2) => {
  const queryJsonHeight = 250;
  return {
    content: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      margin: ${theme.spacing(0, 2, 2)};
      padding: ${theme.spacing(2)};
    `,
    quickInfo: css``,
    queries: css`
      width: 50%;
    `,
    query: css`
      height: ${queryJsonHeight}px;
    `,
    info: css`
      max-width: ${theme.breakpoints.values.md}px;
    `,
  };
};

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
