import { FC } from 'react';

import { RawQuery } from '@grafana/plugin-ui';
import { promqlGrammar } from '@grafana/prometheus';

import { styles } from './MetricsCell.styles';
import { MetricsCellProps } from './MetricsCell.types';

const MetricsCell: FC<MetricsCellProps> = ({ filter }) => (
  <div className={styles.MetricsCell}>
    {!!filter && <RawQuery query={filter} language={{ grammar: promqlGrammar, name: 'promql' }} />}
  </div>
);
export default MetricsCell;
