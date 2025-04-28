import { useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label, useStyles2 } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesLabelSelector } from './styles';
import { METRIC_LABEL } from './types';

export function LabelSelector() {
  const styles = useStyles2(getStylesLabelSelector);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const { labelKeys, selectedLabelKeys, onLabelKeyClick } = useMetricsBrowser();

  const filteredLabelKeys = useMemo(() => {
    return labelKeys.filter(
      (lk) => lk !== METRIC_LABEL && (selectedLabelKeys.includes(lk) || lk.includes(labelSearchTerm))
    );
  }, [labelKeys, labelSearchTerm, selectedLabelKeys]);

  return (
    <div className={styles.section}>
      <Label description="Once label values are selected, only possible label combinations are shown.">
        2. Select labels to search in
      </Label>
      <div>
        <Input
          onChange={(e) => setLabelSearchTerm(e.currentTarget.value)}
          aria-label="Filter expression for label"
          value={labelSearchTerm}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelNamesFilter}
        />
      </div>
      {/* Using fixed height here to prevent jumpy layout */}
      <div className={styles.list} style={{ height: 120 }}>
        {filteredLabelKeys.map((label) => (
          <PromLabel
            key={label}
            name={label}
            loading={false}
            active={selectedLabelKeys.includes(label)}
            hidden={false}
            facets={undefined}
            onClick={(name: string) => {
              // Resetting search to prevent empty results
              setLabelSearchTerm('');
              onLabelKeyClick(name);
            }}
            searchTerm={labelSearchTerm}
          />
        ))}
      </div>
    </div>
  );
}
