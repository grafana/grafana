import { css } from '@emotion/css';
import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { SerializedError } from '@reduxjs/toolkit';
import pluralize from 'pluralize';
import React, { useMemo, ReactElement, useState } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getRulesDataSources, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isRulerNotSupportedResponse } from '../../utils/rules';

export function RuleListErrors(): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [closed, setClosed] = useState(false);
  const promRuleRequests = useUnifiedAlertingSelector((state) => state.promRules);
  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const styles = useStyles2(getStyles);

  const errors = useMemo((): JSX.Element[] => {
    const [promRequestErrors, rulerRequestErrors] = [promRuleRequests, rulerRuleRequests].map((requests) =>
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
    );
    const grafanaPromError = promRuleRequests[GRAFANA_RULES_SOURCE_NAME]?.error;
    const grafanaRulerError = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME]?.error;

    const result: JSX.Element[] = [];

    if (grafanaPromError) {
      result.push(<>Failed to load Grafana rules state: {grafanaPromError.message || 'Unknown error.'}</>);
    }
    if (grafanaRulerError) {
      result.push(<>Failed to load Grafana rules config: {grafanaRulerError.message || 'Unknown error.'}</>);
    }

    promRequestErrors.forEach(({ dataSource, error }) =>
      result.push(
        <>
          Failed to load rules state from <a href={`datasources/edit/${dataSource.uid}`}>{dataSource.name}</a>:{' '}
          {error.message || 'Unknown error.'}
        </>
      )
    );

    rulerRequestErrors.forEach(({ dataSource, error }) =>
      result.push(
        <>
          Failed to load rules config from <a href={'datasources/edit/${dataSource.uid}'}>{dataSource.name}</a>:{' '}
          {error.message || 'Unknown error.'}
        </>
      )
    );

    return result;
  }, [promRuleRequests, rulerRuleRequests]);

  return (
    <>
      {errors.length && !closed && (
        <Alert
          data-testid="cloud-rulessource-errors"
          title="Errors loading rules"
          severity="error"
          onRemove={() => setClosed(true)}
        >
          {expanded && errors.map((item, idx) => <div key={idx}>{item}</div>)}
          {!expanded && (
            <>
              <div>{errors[0]}</div>
              {errors.length >= 2 && (
                <Button className={styles.moreButton} variant="link" size="sm" onClick={() => setExpanded(true)}>
                  {errors.length - 1} more {pluralize('error', errors.length - 1)}
                </Button>
              )}
            </>
          )}
        </Alert>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  moreButton: css`
    padding: 0;
  `,
});
