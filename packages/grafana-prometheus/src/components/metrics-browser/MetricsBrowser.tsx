// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.tsx
import { Stack, useStyles2 } from '@grafana/ui';

import { LabelSelector } from './LabelSelector';
import { MetricSelector } from './MetricSelector';
import { SelectorActions } from './SelectorActions';
import { ValueSelector } from './ValueSelector';
import { getStylesMetricsBrowser } from './styles';

export const MetricsBrowser = () => {
  const styles = useStyles2(getStylesMetricsBrowser);

  return (
    <div className={styles.wrapper}>
      <Stack gap={3}>
        <MetricSelector />
        <div>
          <LabelSelector />

          <ValueSelector />
        </div>
      </Stack>

      <SelectorActions />
    </div>
  );
};
