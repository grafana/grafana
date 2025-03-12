import { ChangeEvent, MouseEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Input, Label, BrowserLabel as PromLabel } from '@grafana/ui';

import { SelectableLabel } from './types';

interface LabelSelectorProps {
  nonMetricLabels: SelectableLabel[];
  labelSearchTerm: string;
  onChangeLabelSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onClickLabel: (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => void;
  styles: Record<string, string>;
}

export function LabelSelector({
  nonMetricLabels,
  labelSearchTerm,
  onChangeLabelSearch,
  onClickLabel,
  styles,
}: LabelSelectorProps) {
  return (
    <div className={styles.section}>
      <Label description="Once label values are selected, only possible label combinations are shown.">
        2. Select labels to search in
      </Label>
      <div>
        <Input
          onChange={onChangeLabelSearch}
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
            onClick={onClickLabel}
            searchTerm={labelSearchTerm}
          />
        ))}
      </div>
    </div>
  );
}
