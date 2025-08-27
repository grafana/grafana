import { useState } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { BrowserLabel as PromLabel, Input, Label, useStyles2, Spinner } from '@grafana/ui';

import { LIST_ITEM_SIZE } from '../../constants';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesValueSelector } from './styles';

export function ValueSelector() {
  const styles = useStyles2(getStylesValueSelector);
  const [valueSearchTerm, setValueSearchTerm] = useState('');
  const { labelValues, selectedLabelValues, isLoadingLabelValues, onLabelValueClick, onLabelKeyClick } =
    useMetricsBrowser();

  return (
    <div className={styles.section}>
      <Label
        description={t(
          'grafana-prometheus.components.value-selector.description-search-field-values-across-selected-labels',
          'Use the search field to find values across selected labels.'
        )}
      >
        <Trans i18nKey="grafana-prometheus.components.value-selector.select-multiple-values-for-your-labels">
          3. Select (multiple) values for your labels
        </Trans>
      </Label>
      <div>
        <Input
          onChange={(e) => setValueSearchTerm(e.currentTarget.value)}
          aria-label={t(
            'grafana-prometheus.components.value-selector.aria-label-filter-expression-for-label-values',
            'Filter expression for label values'
          )}
          value={valueSearchTerm}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter}
        />
      </div>
      {!isLoadingLabelValues && (
        <div className={styles.valueListArea}>
          {Object.entries(labelValues).map(([lk, lv]) => {
            if (!lk || !lv) {
              console.error('label values are empty:', { lk, lv });
              return null;
            }
            return (
              <div
                role="list"
                key={lk}
                aria-label={t(
                  'grafana-prometheus.components.value-selector.aria-label-values-for',
                  'Values for {{labelKey}}',
                  {
                    labelKey: lk,
                  }
                )}
                className={styles.valueListWrapper}
              >
                <div className={styles.valueTitle}>
                  <PromLabel name={lk} active={true} hidden={false} facets={lv.length} onClick={onLabelKeyClick} />
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
      )}
      {isLoadingLabelValues && (
        <div className={styles.spinner}>
          <Spinner size="xl" />
        </div>
      )}
    </div>
  );
}
