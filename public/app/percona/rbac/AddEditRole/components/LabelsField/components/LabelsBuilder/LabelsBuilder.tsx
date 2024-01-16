import React, { FC, useMemo } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { promQueryModeller } from 'app/plugins/datasource/prometheus/querybuilder/PromQueryModeller';
import { MetricsLabelsSection } from 'app/plugins/datasource/prometheus/querybuilder/components/MetricsLabelsSection';
import { QueryPreview } from 'app/plugins/datasource/prometheus/querybuilder/components/QueryPreview';
import { buildVisualQueryFromString } from 'app/plugins/datasource/prometheus/querybuilder/parsing';
import { PromVisualQuery } from 'app/plugins/datasource/prometheus/querybuilder/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { styles } from './LabelsBuilder.styles';

interface LabelsBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const LabelsBuilder: FC<LabelsBuilderProps> = ({ value, onChange }) => {
  const source = getDataSourceSrv().getInstanceSettings();
  const datasource = source ? new PrometheusDatasource(source) : undefined;
  const query = useMemo<PromQuery>(() => ({ refId: '', expr: value }), [value]);
  const visualQuery = useMemo(() => buildVisualQueryFromString(query.expr).query, [query.expr]);

  if (!datasource) {
    return null;
  }

  const handleQueryChange = (visualQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visualQuery);
    onChange(expr);
  };

  return (
    <div className={styles.QueryBuilder}>
      <MetricsLabelsSection datasource={datasource} onChange={handleQueryChange} query={visualQuery} hideMetric />
      <div />
      {query.expr && <QueryPreview query={query.expr} />}
    </div>
  );
};

export default LabelsBuilder;
