import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Field, PageToolbar, TextArea, withErrorBoundary, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { fetchPromRulesAction, fetchRulerRulesAction } from './state/actions';
import { contextSrv } from 'app/core/services/context_srv';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { equalIdentifiers, getRuleIdentifier, parseRuleIdentifier } from './utils/rules';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { useObservable } from 'react-use';
import { CombinedRule, RuleIdentifier, RuleNamespace } from 'app/types/unified-alerting';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { AsyncRequestState } from './utils/redux';
import { AlertQuery, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { SerializedError } from '@reduxjs/toolkit';
import { RuleState } from './components/rules/RuleState';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string; sourceName?: string }>;
const isEditor = contextSrv.isEditor;
const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const { id, sourceName } = match.params;
  const identifier = getIdentifier(id);
  const { loading, error, rule } = useAsyncCombineRule(identifier, sourceName);
  const styles = useStyles2(getStyles);
  const runner = useMemo(() => new AlertingQueryRunner(), []);
  const data = useObservable(runner.get());

  const onRunQueries = useCallback(() => {
    const queries: AlertQuery[] = []; //alertRuleToQueries(result);

    if (queries.length === 0) {
      return;
    }

    runner.run(queries);
  }, [runner]);

  useEffect(() => {
    return () => runner.destroy();
  }, [runner]);

  if (!identifier) {
    return <div>no rule</div>;
  }

  if (!rule) {
    return <div>no alert rule</div>;
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
          {/*{rule &&*/}
          {/*  rule.data.map((query, index) => {*/}
          {/*    return (*/}
          {/*      <div key={index} className={styles.query}>*/}
          {/*        <span>vis</span>*/}
          {/*        <CodeEditor*/}
          {/*          language="json"*/}
          {/*          readOnly*/}
          {/*          value={JSON.stringify(query.model, null, 2)}*/}
          {/*          height={200}*/}
          {/*          showMiniMap={false}*/}
          {/*        />*/}
          {/*      </div>*/}
          {/*    );*/}
          {/*  })}*/}
        </div>
      </div>
    </Page>
  );
};

type AsyncCombineRuleState = { error?: SerializedError | undefined; loading: boolean; rule?: CombinedRule };

function useAsyncCombineRule(identifier?: RuleIdentifier, sourceName?: string): AsyncCombineRuleState {
  const [state, setState] = useState<AsyncCombineRuleState>({ loading: false });
  const promRuleState = useAsyncPromRulesLoader(sourceName);
  const rulerRuleState = useAsyncRulerRulesLoader(sourceName);
  const combinedRules = useCombinedRuleNamespaces(sourceName);

  useEffect(() => {
    if (!identifier || !sourceName || state.rule) {
      return;
    }

    if (promRuleState?.error || rulerRuleState?.error) {
      const error = promRuleState?.error ?? rulerRuleState?.error;
      setState({ loading: false, error });
      return;
    }

    if (promRuleState?.loading || rulerRuleState?.loading) {
      setState({ loading: true });
      return;
    }

    if (combinedRules.length === 0) {
      return;
    }

    let combinedRule: CombinedRule | undefined;

    namespaces: for (const namespace of combinedRules) {
      for (const group of namespace.groups) {
        for (const rule of group.rules) {
          if (!rule.rulerRule) {
            continue;
          }

          const id = getRuleIdentifier(sourceName, namespace.name, group.name, rule.rulerRule);

          if (equalIdentifiers(id, identifier)) {
            combinedRule = rule;
            break namespaces;
          }
        }
      }
    }

    setState({ loading: false, rule: combinedRule, error: undefined });
  }, [
    combinedRules,
    identifier,
    sourceName,
    promRuleState?.loading,
    rulerRuleState?.loading,
    promRuleState?.error,
    rulerRuleState?.error,
    state.rule,
  ]);

  return state;
}

function useAsyncPromRulesLoader(sourceName?: string): AsyncRequestState<RuleNamespace[]> | undefined {
  const dispatch = useDispatch();
  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const promRuleRequest = promRuleRequests[sourceName ?? ''];

  useEffect(() => {
    if (!sourceName) {
      return;
    }
    if (promRuleRequest?.loading || promRuleRequest?.error) {
      return;
    }
    if (!promRuleRequest?.dispatched) {
      dispatch(fetchPromRulesAction(sourceName));
    }
  }, [dispatch, promRuleRequest, sourceName]);

  return promRuleRequest;
}

function useAsyncRulerRulesLoader(sourceName?: string): AsyncRequestState<RulerRulesConfigDTO | null> | undefined {
  const dispatch = useDispatch();
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRuleRequest = rulerRuleRequests[sourceName ?? ''];

  useEffect(() => {
    if (!sourceName) {
      return;
    }
    if (rulerRuleRequest?.loading || rulerRuleRequest?.error) {
      return;
    }
    if (!rulerRuleRequest?.dispatched) {
      dispatch(fetchRulerRulesAction(sourceName));
    }
  }, [dispatch, rulerRuleRequest, sourceName]);

  return rulerRuleRequest;
}

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
