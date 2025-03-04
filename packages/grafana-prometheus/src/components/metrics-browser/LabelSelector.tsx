import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label } from '@grafana/ui';

import { METRIC_LABEL, SelectableLabel } from './types';

interface LabelSelectorProps {
  labels: SelectableLabel[];
  onClickLabel: (name: string, value: string | undefined) => void;
  styles: Record<string, string>;
}

export function LabelSelector({ onClickLabel, styles, labels }: LabelSelectorProps) {
  const [labelSearchTerm, setLabelSearchTerm] = useState('');

  // Filter labels
  let nonMetricLabels = labels.filter((label) => !label.hidden && label.name !== METRIC_LABEL);
  if (labelSearchTerm) {
    nonMetricLabels = nonMetricLabels.filter((label) => label.selected || label.name.includes(labelSearchTerm));
  }

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
        {nonMetricLabels.map((label) => (
          <PromLabel
            key={label.name}
            name={label.name}
            loading={label.loading}
            active={label.selected}
            hidden={label.hidden}
            facets={label.facets}
            onClick={(name: string, value: string | undefined) => {
              // Resetting search to prevent empty results
              setLabelSearchTerm('');
              onClickLabel(name, value);
            }}
            searchTerm={labelSearchTerm}
          />
        ))}
      </div>
    </div>
  );
}
