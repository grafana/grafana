import React, { FC } from 'react';

import promqlGrammar from 'app/plugins/datasource/prometheus/promql';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import { styles } from './MetricsCell.styles';
import { MetricsCellProps } from './MetricsCell.types';

const MetricsCell: FC<MetricsCellProps> = ({ filter }) => (
  <div className={styles.MetricsCell}>
    {!!filter && <RawQuery query={filter} lang={{ grammar: promqlGrammar, name: 'promql' }} />}
  </div>
);
export default MetricsCell;
