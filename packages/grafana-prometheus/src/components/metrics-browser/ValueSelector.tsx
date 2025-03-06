import { useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { BrowserLabel as PromLabel, Input, Label, useStyles2 } from '@grafana/ui';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesValueSelector } from './styles';
import { LIST_ITEM_SIZE } from './types';

export function ValueSelector() {
  const styles = useStyles2(getStylesValueSelector);
  const [valueSearchTerm, setValueSearchTerm] = useState('');
  const { labelValues, selectedLabelValues, onLabelValueClick, onLabelKeyClick } = useMetricsBrowser();

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
                return (
                  <div style={style}>
                    <PromLabel
                      name={value}
                      value={value}
                      active={selectedLabelValues[labelKey]?.includes(value)}
                      onClick={(name) => onLabelValueClick(labelKey, name)}
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
