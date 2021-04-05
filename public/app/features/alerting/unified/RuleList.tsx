import { DataSourceInstanceSettings, GrafanaTheme } from '@grafana/data';
import { Icon, InfoBox, useStyles, Button } from '@grafana/ui';
import { SerializedError } from '@reduxjs/toolkit';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { NoRulesSplash } from './components/rules/NoRulesCTA';
import { SystemOrApplicationRules } from './components/rules/SystemOrApplicationRules';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAllPromAndRulerRules } from './state/actions';
import {
  getAllRulesSourceNames,
  getRulesDataSources,
  GRAFANA_RULES_SOURCE_NAME,
  isCloudRulesSource,
} from './utils/datasource';
import { css } from '@emotion/css';
import { ThresholdRules } from './components/rules/ThresholdRules';
import { useCombinedRuleNamespaces } from './hooks/useCombinedRuleNamespaces';
import { RULE_LIST_POLL_INTERVAL_MS } from './utils/constants';
import { isRulerNotSupportedResponse } from './utils/rules';

export const RuleList: FC = () => {
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);
  const rulesDataSourceNames = useMemo(getAllRulesSourceNames, []);

  // fetch rules, then poll every RULE_LIST_POLL_INTERVAL_MS
  useEffect(() => {
    dispatch(fetchAllPromAndRulerRules());
    const interval = setInterval(() => dispatch(fetchAllPromAndRulerRules()), RULE_LIST_POLL_INTERVAL_MS);
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

  const combinedNamespaces = useCombinedRuleNamespaces();
  const [thresholdNamespaces, systemNamespaces] = useMemo(() => {
    const sorted = combinedNamespaces
      .map((namespace) => ({
        ...namespace,
        groups: namespace.groups.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      sorted.filter((ns) => ns.rulesSource === GRAFANA_RULES_SOURCE_NAME),
      sorted.filter((ns) => isCloudRulesSource(ns.rulesSource)),
    ];
  }, [combinedNamespaces]);

  return (
    <AlertingPageWrapper pageId="alert-list" isLoading={loading && !haveResults}>
      {(promReqeustErrors.length || rulerRequestErrors.length || grafanaPromError) && (
        <InfoBox
          data-testid="cloud-rulessource-errors"
          title={
            <h4>
              <Icon className={styles.iconError} name="exclamation-triangle" size="xl" />
              Errors loading rules
            </h4>
          }
          severity="error"
        >
          {grafanaPromError && (
            <div>Failed to load Grafana threshold rules state: {grafanaPromError.message || 'Unknown error.'}</div>
          )}
          {grafanaRulerError && (
            <div>Failed to load Grafana threshold rules config: {grafanaRulerError.message || 'Unknown error.'}</div>
          )}
          {promReqeustErrors.map(({ dataSource, error }) => (
            <div key={dataSource.name}>
              Failed to load rules state from <a href={`datasources/edit/${dataSource.id}`}>{dataSource.name}</a>:{' '}
              {error.message || 'Unknown error.'}
            </div>
          ))}
          {rulerRequestErrors.map(({ dataSource, error }) => (
            <div key={dataSource.name}>
              Failed to load rules config from <a href={`datasources/edit/${dataSource.id}`}>{dataSource.name}</a>:{' '}
              {error.message || 'Unknown error.'}
            </div>
          ))}
        </InfoBox>
      )}
      <div className={styles.buttonsContainer}>
        <div />
        <a href="/alerting/new">
          <Button icon="plus">New alert rule</Button>
        </a>
      </div>
      {dispatched && !loading && !haveResults && <NoRulesSplash />}
      {haveResults && <ThresholdRules namespaces={thresholdNamespaces} />}
      {haveResults && <SystemOrApplicationRules namespaces={systemNamespaces} />}
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
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
