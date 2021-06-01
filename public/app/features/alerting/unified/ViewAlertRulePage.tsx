import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
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
import { VizWrapper } from './components/rule-editor/VizWrapper';
import { SupportedPanelPlugins } from './components/rule-editor/QueryWrapper';
import { TABLE, TIMESERIES } from './utils/constants';
import { isExpressionQuery } from '../../expressions/guards';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;
const isEditor = contextSrv.isEditor;

const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const styles = useStyles2(getStyles);
  const [panelId, setPanelId] = useState<SupportedPanelPlugins>(TIMESERIES);
  const { id, sourceName } = match.params;
  const identifier = getIdentifier(id);
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

  if (!rule) {
    return <div>no alert rule</div>;
  }

  if (loading) {
    return <div>loading rule</div>;
  }

  if (error) {
    return <div>could not load rule due to error</div>;
  }

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
          {queries.map((query, index) => {
            return (
              <div key={index}>
                <div className={styles.query}>
                  {data && (
                    <VizWrapper
                      data={data[query.refId]}
                      currentPanel={isExpressionQuery(query.model) ? TABLE : panelId}
                      changePanel={setPanelId}
                    />
                  )}
                  <CodeEditor
                    language="json"
                    readOnly
                    value={JSON.stringify(query.model, null, 2)}
                    height={200}
                    showMiniMap={false}
                  />
                </div>
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
      height: 450px;
    `,
    info: css`
      max-width: ${theme.breakpoints.values.md}px;
    `,
  };
};

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
