import { cx } from '@emotion/css';
import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Label, Stack, useStyles2 } from '@grafana/ui';

import { EMPTY_SELECTOR } from '../../constants';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesSelectorActions } from './styles';

export function SelectorActions() {
  const styles = useStyles2(getStylesSelectorActions);
  const { validationStatus, onValidationClick, getSelector, onChange, status, err, onClearClick } = useMetricsBrowser();

  const selector = getSelector();

  const onClickRunQuery = () => {
    onChange(selector);
  };

  const onClickRunRateQuery = () => {
    const query = `rate(${selector}[$__rate_interval])`;
    onChange(query);
  };

  const empty = useMemo(() => selector === EMPTY_SELECTOR, [selector]);

  return (
    <div className={styles.section}>
      <Label>
        <Trans i18nKey="grafana-prometheus.components.selector-actions.resulting-selector">4. Resulting selector</Trans>
      </Label>
      <div
        aria-label={t('grafana-prometheus.components.selector-actions.aria-label-selector', 'selector')}
        className={styles.selector}
      >
        {selector}
      </div>
      {validationStatus && <div className={styles.validationStatus}>{validationStatus}</div>}
      <Stack>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery}
          aria-label={t(
            'grafana-prometheus.components.selector-actions.aria-label-use-selector-for-query-button',
            'Use selector for query button'
          )}
          disabled={empty}
          onClick={onClickRunQuery}
        >
          <Trans i18nKey="grafana-prometheus.components.selector-actions.use-query">Use query</Trans>
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useAsRateQuery}
          aria-label={t(
            'grafana-prometheus.components.selector-actions.aria-label-use-selector-as-metrics-button',
            'Use selector as metrics button'
          )}
          variant="secondary"
          disabled={empty}
          onClick={onClickRunRateQuery}
        >
          <Trans i18nKey="grafana-prometheus.components.selector-actions.use-as-rate-query">Use as rate query</Trans>
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.validateSelector}
          aria-label={t(
            'grafana-prometheus.components.selector-actions.aria-label-validate-submit-button',
            'Validate submit button'
          )}
          variant="secondary"
          disabled={empty}
          onClick={onValidationClick}
        >
          <Trans i18nKey="grafana-prometheus.components.selector-actions.validate-selector">Validate selector</Trans>
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear}
          aria-label={t(
            'grafana-prometheus.components.selector-actions.aria-label-selector-clear-button',
            'Selector clear button'
          )}
          variant="secondary"
          onClick={onClearClick}
        >
          <Trans i18nKey="grafana-prometheus.components.selector-actions.clear">Clear</Trans>
        </Button>
        <div className={cx(styles.status, (status || err) && styles.statusShowing)}>
          <span className={err ? styles.error : ''}>{err || status}</span>
        </div>
      </Stack>
    </div>
  );
}
