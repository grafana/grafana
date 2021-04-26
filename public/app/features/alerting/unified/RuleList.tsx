import { DataSourceInstanceSettings, GrafanaTheme, urlUtil } from '@grafana/data';
import { useStyles, Button, ButtonGroup, ToolbarButton, Alert } from '@grafana/ui';
import { SerializedError } from '@reduxjs/toolkit';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useFilteredRules } from './hooks/useFilteredRules';
import { fetchAllPromAndRulerRulesAction } from './state/actions';
import { getAllRulesSourceNames, getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { css } from '@emotion/css';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { isRulerNotSupportedResponse } from './utils/rules';
import RulesFilter from './components/rules/RulesFilter';
import { RuleListGroupView } from './components/rules/RuleListGroupView';
import { RuleListStateView } from './components/rules/RuleListStateView';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { config } from '@grafana/runtime';

const VIEWS = {
  groups: RuleListGroupView,
  state: RuleListStateView,
};

export const RuleList: FC = () => {
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);
  const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);

  const [queryParams] = useQueryParams();

  const view = VIEWS[queryParams['view'] as keyof typeof VIEWS]
    ? (queryParams['view'] as keyof typeof VIEWS)
    : 'groups';

  const ViewComponent = VIEWS[view];

  // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
  useEffect(() => {
    dispatch(fetchAllPromAndRulerRulesAction());
    const interval = setInterval(() => dispatch(fetchAllPromAndRulerRulesAction()), RULE_LIST_POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [dispatch]);

  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);

  const dispatched = rulesDataSourceNames.some(
    (name) => promRuleRequests[name]?.dispatched || rulerRuleRequests[name]?.dispatched
  );
  const loading = rulesDataSourceNames.some(
    (name) => promRuleRequests[name]?.loading || rulerRuleRequests[name]?.loading
  );
  const haveResults = rulesDataSourceNames.some(
    (name) =>
      (promRuleRequests[name]?.result?.length && !promRuleRequests[name]?.error) ||
      (Object.keys(rulerRuleRequests[name]?.result || {}).length && !rulerRuleRequests[name]?.error)
  );

  const [promReqeustErrors, rulerRequestErrors] = useMemo(
    () =>
      [promRuleRequests, rulerRuleRequests].map((requests) =>
        getRulesDataSources().reduce<Array<{ error: SerializedError; dataSource: DataSourceInstanceSettings }>>(
          (result, dataSource) => {
            const error = requests[dataSource.name]?.error;
            if (requests[dataSource.name] && error && !isRulerNotSupportedResponse(requests[dataSource.name])) {
              return [...result, { dataSource, error }];
            }
            return result;
          },
          []
        )
      ),
    [promRuleRequests, rulerRuleRequests]
  );

  const grafanaPromError = promRuleRequests[GRAFANA_RULES_SOURCE_NAME]?.error;
  const grafanaRulerError = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME]?.error;

  const showNewAlertSplash = dispatched && !loading && !haveResults;

  const combinedNamespaces = useCombinedRuleNamespaces();
  const filteredNamespaces = useFilteredRules(combinedNamespaces);
  return (
    <AlertingPageWrapper pageId="alert-list" isLoading={loading && !haveResults}>
      {(promReqeustErrors.length || rulerRequestErrors.length || grafanaPromError) && (
        <Alert data-testid="cloud-rulessource-errors" title="Errors loading rules" severity="error">
          {grafanaPromError && (
            <div>Failed to load Grafana threshold rules state: {grafanaPromError.message || 'Unknown error.'}</div>
          )}
          {grafanaRulerError && (
            <div>Failed to load Grafana threshold rules config: {grafanaRulerError.message || 'Unknown error.'}</div>
          )}
          {promReqeustErrors.map(({ dataSource, error }) => (
            <div key={dataSource.name}>
              Failed to load rules state from{' '}
              <a href={`${config.appSubUrl ?? ''}/datasources/edit/${dataSource.id}`}>{dataSource.name}</a>:{' '}
              {error.message || 'Unknown error.'}
            </div>
          ))}
          {rulerRequestErrors.map(({ dataSource, error }) => (
            <div key={dataSource.name}>
              Failed to load rules config from{' '}
              <a href={`${config.appSubUrl ?? ''}/datasources/edit/${dataSource.id}`}>{dataSource.name}</a>:{' '}
              {error.message || 'Unknown error.'}
            </div>
          ))}
        </Alert>
      )}
      {!showNewAlertSplash && (
        <>
          <RulesFilter />
          <div className={styles.break} />
          <div className={styles.buttonsContainer}>
            <ButtonGroup>
              <a href={urlUtil.renderUrl(`${config.appSubUrl ?? ''}/alerting/list`, { ...queryParams, view: 'group' })}>
                <ToolbarButton variant={view === 'groups' ? 'active' : 'default'} icon="folder">
                  Groups
                </ToolbarButton>
              </a>
              <a href={urlUtil.renderUrl(`${config.appSubUrl ?? ''}/alerting/list`, { ...queryParams, view: 'state' })}>
                <ToolbarButton variant={view === 'state' ? 'active' : 'default'} icon="heart-rate">
                  State
                </ToolbarButton>
              </a>
            </ButtonGroup>
            <div />
            <a href={`${config.appSubUrl ?? ''}/alerting/new`}>
              <Button icon="plus">New alert rule</Button>
            </a>
          </div>
        </>
      )}
      {showNewAlertSplash && <NoRulesSplash />}
      {haveResults && <ViewComponent namespaces={filteredNamespaces} />}
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing.md};
    border-bottom: solid 1px ${theme.colors.border2};
  `,
  iconError: css`
    color: ${theme.palette.red};
    margin-right: ${theme.spacing.md};
  `,
  buttonsContainer: css`
    margin-bottom: ${theme.spacing.md};
    display: flex;
    justify-content: space-between;
  `,
});
