import { cx } from '@emotion/css';
import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Label, Stack } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { buildSelector } from './selectorBuilder';
import { EMPTY_SELECTOR, SelectableLabel } from './types';

interface SelectorActionsProps {
  labels: SelectableLabel[];
  onClickClear: () => void;
  styles: Record<string, string>;
}

export function SelectorActions({
  labels,
  onClickClear,
  styles,
}: SelectorActionsProps) {
  const [validationStatus, setValidationStatus] = useState('');
  const { languageProvider, onChange, status, err, setErr } = useMetricsBrowser();

  const validateSelector = async (selector: string) => {
    setValidationStatus(`Validating selector ${selector}`);
    setErr('');
    const streams = await languageProvider.fetchSeries(selector);
    setValidationStatus(`Selector is valid (${streams.length} series found)`);
  };

  const onClickValidate = () => {
    const selector = buildSelector(labels);
    validateSelector(selector);
  };

  const onClickRunQuery = () => {
    const selector = buildSelector(labels);
    onChange(selector);
  };

  const onClickRunRateQuery = () => {
    const selector = buildSelector(labels);
    const query = `rate(${selector}[$__rate_interval])`;
    onChange(query);
  };

  const selector = buildSelector(labels);
  const empty = selector === EMPTY_SELECTOR;

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
          onClick={onClickValidate}
        >
          Validate selector
        </Button>
        <Button
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear}
          aria-label="Selector clear button"
          variant="secondary"
          onClick={onClickClear}
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
