import { cx } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Label, Stack } from '@grafana/ui';

interface SelectorActionsProps {
  selector: string;
  validationStatus: string;
  status: string;
  error: string;
  empty: boolean;
  onClickRunQuery: () => void;
  onClickRunRateQuery: () => void;
  onClickValidate: () => void;
  onClickClear: () => void;
  styles: Record<string, string>;
}

export function SelectorActions({
  selector,
  validationStatus,
  status,
  error,
  empty,
  onClickRunQuery,
  onClickRunRateQuery,
  onClickValidate,
  onClickClear,
  styles,
}: SelectorActionsProps) {
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
        <div className={cx(styles.status, (status || error) && styles.statusShowing)}>
          <span className={error ? styles.error : ''}>{error || status}</span>
        </div>
      </Stack>
    </div>
  );
}
