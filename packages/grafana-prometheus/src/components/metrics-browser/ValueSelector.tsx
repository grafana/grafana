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
        {Object.entries(labelValues).map(([lk, lv]) => {
          if (!lk || !lv) {
            console.error('label values are empty:', { lk, lv });
            return null;
          }
          return (
            <div role="list" key={lk} aria-label={`Values for ${lk}`} className={styles.valueListWrapper}>
              <div className={styles.valueTitle}>
                <PromLabel
                  name={lk}
                  loading={false}
                  active={true}
                  hidden={false}
                  facets={lv.length}
                  onClick={onLabelKeyClick}
                />
              </div>
              <FixedSizeList
                height={Math.min(200, LIST_ITEM_SIZE * (lv.length || 0))}
                itemCount={lv.length || 0}
                itemSize={28}
                itemKey={(i) => lv[i]}
                width={200}
                className={styles.valueList}
              >
                {({ index, style }) => {
                  const value = lv[index];
                  const isSelected = selectedLabelValues[lk]?.includes(value);
                  return (
                    <div style={style}>
                      <PromLabel
                        name={value}
                        value={value}
                        active={isSelected}
                        onClick={(name) => onLabelValueClick(lk, name, !isSelected)}
                        searchTerm={valueSearchTerm}
                      />
                    </div>
                  );
                }}
              </FixedSizeList>
            </div>
          );
        })}
      </div>
    </div>
  );
}
