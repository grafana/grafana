import { css } from '@emotion/css';
import { SerializedError } from '@reduxjs/toolkit';
import { FC, ReactElement, useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';
import { isRulerNotSupportedResponse } from '../../utils/rules';

export function RuleListErrors(): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [closed, setClosed] = useLocalStorage('grafana.unifiedalerting.hideErrors', false);
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

    const unknownError = t('alerting.rule-list-errors.unknown-error', 'Unknown error.');

    if (grafanaPromError) {
      result.push(
        <>
          <Trans i18nKey="alerting.rule-list-errors.failed-to-load-grafana-rules-state">
            Failed to load Grafana rules state:
          </Trans>{' '}
          {grafanaPromError.message || unknownError}
        </>
      );
    }
    if (grafanaRulerError) {
      result.push(
        <>
          <Trans i18nKey="alerting.rule-list-errors.failed-to-load-grafana-rules-config">
            Failed to load Grafana rules config:
          </Trans>{' '}
          {grafanaRulerError?.message || unknownError}
        </>
      );
    }

    promRequestErrors.forEach(({ dataSource, error }) =>
      result.push(
        <>
          <Trans
            i18nKey="alerting.rule-list-errors.failed-to-load-rules-state"
            values={{ dataSource: dataSource.name }}
          >
            Failed to load rules state from{' '}
            <a href={makeDataSourceLink(dataSource.uid)} className={styles.dsLink}>
              {'{{dataSource}}'}
            </a>
          </Trans>
          : {error.message || unknownError}
        </>
      )
    );

    rulerRequestErrors.forEach(({ dataSource, error }) =>
      result.push(
        <>
          <Trans
            i18nKey="alerting.rule-list-errors.failed-to-load-rules-config"
            values={{ dataSource: dataSource.name }}
          >
            Failed to load rules config from{' '}
            <a href={makeDataSourceLink(dataSource.uid)} className={styles.dsLink}>
              {'{{dataSource}}'}
            </a>
          </Trans>
          : {error.message || unknownError}
        </>
      )
    );

    return result;
  }, [promRuleRequests, rulerRuleRequests, styles.dsLink]);

  return (
    <>
      {!!errors.length && closed && (
        <ErrorSummaryButton count={errors.length} onClick={() => setClosed((closed) => !closed)} />
      )}
      {!!errors.length && !closed && (
        <Alert
          data-testid="cloud-rulessource-errors"
          title={t(
            'alerting.rule-list-errors.cloud-rulessource-errors-title-errors-loading-rules',
            'Errors loading rules'
          )}
          severity="error"
          onRemove={() => setClosed(true)}
        >
          {expanded && errors.map((item, idx) => <div key={idx}>{item}</div>)}
          {!expanded && (
            <>
              <div>{errors[0]}</div>
              {errors.length >= 2 && (
                <Button
                  className={styles.moreButton}
                  fill="text"
                  icon="angle-right"
                  size="sm"
                  onClick={() => setExpanded(true)}
                >
                  <Trans i18nKey="alerting.rule-list-errors.more-errors" count={errors.length - 1}>
                    {'{{count}}'} more errors
                  </Trans>
                </Button>
              )}
            </>
          )}
        </Alert>
      )}
    </>
  );
}

interface ErrorSummaryProps {
  count: number;
  onClick: () => void;
}

const ErrorSummaryButton: FC<ErrorSummaryProps> = ({ count, onClick }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.floatRight}>
      <Tooltip content="Show all errors" placement="bottom">
        <Button fill="text" variant="destructive" icon="exclamation-triangle" onClick={onClick}>
          <Trans i18nKey="alerting.rule-list-errors.button-errors" count={count}>
            {'{{count}}'} errors
          </Trans>
        </Button>
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  moreButton: css({
    padding: 0,
  }),
  floatRight: css({
    display: 'flex',
    justifyContent: 'flex-end',
  }),
  dsLink: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.link,
  }),
});
