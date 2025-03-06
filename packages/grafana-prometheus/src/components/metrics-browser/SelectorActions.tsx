import { cx } from '@emotion/css';
import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Label, Stack, useStyles2 } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesSelectorActions } from './styles';
import { EMPTY_SELECTOR } from './types';

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
      <Label>4. Resulting selector</Label>
      <div aria-label="selector" className={styles.selector}>
        {selector}
      </div>
      {validationStatus && <div className={styles.validationStatus}>{validationStatus}</div>}
      <Stack>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery}
          aria-label="Use selector for query button"
          disabled={empty}
          onClick={onClickRunQuery}
        >
          Use query
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useAsRateQuery}
          aria-label="Use selector as metrics button"
          variant="secondary"
          disabled={empty}
          onClick={onClickRunRateQuery}
        >
          Use as rate query
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.validateSelector}
          aria-label="Validate submit button"
          variant="secondary"
          disabled={empty}
          onClick={onValidationClick}
        >
          Validate selector
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear}
          aria-label="Selector clear button"
          variant="secondary"
          onClick={onClearClick}
        >
          Clear
        </Button>
        <div className={cx(styles.status, (status || err) && styles.statusShowing)}>
          <span className={err ? styles.error : ''}>{err || status}</span>
        </div>
      </Stack>
    </div>
  );
}
