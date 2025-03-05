import { useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { Input, Label, BrowserLabel as PromLabel } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { SelectableLabel, LIST_ITEM_SIZE } from './types';

interface ValueSelectorProps {
  labels: SelectableLabel[];
  styles: Record<string, string>;
}

export function ValueSelector({ styles }: ValueSelectorProps) {
  const [valueSearchTerm, setValueSearchTerm] = useState('');
  const { labelValues, selectedLabelValues, onLabelValueClick, onLabelKeyClick } = useMetricsBrowser();

  // let nonMetricLabels = labels.filter((label) => !label.hidden && label.name !== METRIC_LABEL);
  // // Filter non-metric label values
  // let selectedLabels = nonMetricLabels.filter((label) => label.selected && label.values);
  // if (valueSearchTerm) {
  //   selectedLabels = selectedLabels.map((label) => ({
  //     ...label,
  //     values: label.values?.filter((value) => value.selected || value.name.includes(valueSearchTerm)),
  //   }));
  // }

  return (
    <div className={styles.section}>
      <Label description="Use the search field to find values across selected labels.">
        3. Select (multiple) values for your labels
      </Label>
      <div>
        <Input
          onChange={(e) => setValueSearchTerm(e.currentTarget.value)}
          aria-label="Filter expression for label values"
          value={valueSearchTerm}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter}
        />
      </div>
      <div className={styles.valueListArea}>
        {Object.entries(labelValues).map(([labelKey, labelValues]) => (
          <div role="list" key={labelKey} aria-label={`Values for ${labelKey}`} className={styles.valueListWrapper}>
            <div className={styles.valueTitle}>
              <PromLabel
                name={labelKey}
                loading={false}
                active={true}
                hidden={false}
                // If no facets, we want to show number of all label values
                facets={labelValues.length}
                onClick={onLabelKeyClick}
              />
            </div>
            <FixedSizeList
              height={Math.min(200, LIST_ITEM_SIZE * (labelValues.length || 0))}
              itemCount={labelValues.length || 0}
              itemSize={28}
              itemKey={(i) => labelValues[i]}
              width={200}
              className={styles.valueList}
            >
              {({ index, style }) => {
                const value = labelValues[index];
                // if (!value) {
                //   return null;
                // }
                return (
                  <div style={style}>
                    <PromLabel
                      name={value}
                      value={value}
                      active={selectedLabelValues.includes(value)}
                      onClick={onLabelValueClick}
                      searchTerm={valueSearchTerm}
                    />
                  </div>
                );
              }}
            </FixedSizeList>
          </div>
        ))}
      </div>
    </div>
  );
}
