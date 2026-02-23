import { useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { BrowserLabel as PromLabel, Input, Label, useStyles2, Spinner } from '@grafana/ui';

import { METRIC_LABEL } from '../../constants';

import { useMetricsBrowser } from './MetricsBrowserContext';
import { getStylesLabelSelector, getStylesMetricsBrowser } from './styles';

export function LabelSelector() {
  const styles = useStyles2(getStylesLabelSelector);
  const sharedStyles = useStyles2(getStylesMetricsBrowser);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const { labelKeys, isLoadingLabelKeys, selectedLabelKeys, onLabelKeyClick } = useMetricsBrowser();

  const filteredLabelKeys = useMemo(() => {
    return labelKeys.filter(
      (lk) => lk !== METRIC_LABEL && (selectedLabelKeys.includes(lk) || lk.includes(labelSearchTerm))
    );
  }, [labelKeys, labelSearchTerm, selectedLabelKeys]);

  return (
    <div className={styles.section}>
      <Label
        description={t(
          'grafana-prometheus.components.label-selector.description-select-labels',
          'Once label values are selected, only possible label combinations are shown.'
        )}
      >
        <Trans i18nKey="grafana-prometheus.components.label-selector.select-labels-to-search-in">
          2. Select labels to search in
        </Trans>
      </Label>
      <div>
        <Input
          onChange={(e) => setLabelSearchTerm(e.currentTarget.value)}
          aria-label={t(
            'grafana-prometheus.components.label-selector.aria-label-filter-expression-for-label',
            'Filter expression for label'
          )}
          value={labelSearchTerm}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelNamesFilter}
        />
      </div>
      {/* Using fixed height here to prevent jumpy layout */}
      {isLoadingLabelKeys ? (
        <div className={sharedStyles.spinner}>
          <Spinner size="xl" />
        </div>
      ) : (
        <div className={styles.list} style={{ height: 120 }}>
          {filteredLabelKeys.map((label) => (
            <PromLabel
              key={label}
              name={label}
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
      )}
    </div>
  );
}
