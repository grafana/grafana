import React, { FC, useMemo, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { promQueryModeller } from 'app/plugins/datasource/prometheus/querybuilder/PromQueryModeller';
import { PromQueryBuilder } from 'app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilder';
import { QueryPreview } from 'app/plugins/datasource/prometheus/querybuilder/components/QueryPreview';
import { buildVisualQueryFromString } from 'app/plugins/datasource/prometheus/querybuilder/parsing';
import { PromVisualQuery } from 'app/plugins/datasource/prometheus/querybuilder/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { styles } from './LabelsBuilder.styles';

interface LabelsBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const LabelsBuilder: FC<React.PropsWithChildren<LabelsBuilderProps>> = ({ value, onChange }) => {
  const source = getDataSourceSrv().getInstanceSettings();
  const datasource = source ? new PrometheusDatasource(source) : undefined;
  const [query, setQuery] = useState<PromQuery>({
    refId: '',
    expr: value,
  });
  const visualQuery = useMemo(() => buildVisualQueryFromString(query.expr).query, [query.expr]);

  if (!datasource) {
    return null;
  }

  const handleQueryChange = (visualQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visualQuery);
    onChange(expr);
    setQuery((prev) => ({ ...prev, expr }));
  };

  return (
    <div className={styles.QueryBuilder}>
      <PromQueryBuilder
        datasource={datasource}
        onChange={handleQueryChange}
        onRunQuery={console.log}
        query={visualQuery}
        showExplain={false}
        hideMetric
        hideOperations
      />
      <div />
      {query.expr && <QueryPreview query={query.expr} />}
    </div>
  );
};

export default LabelsBuilder;
