import { dump } from 'js-yaml';
import React from 'react';

import { AlertDataQuery } from 'app/types/unified-alerting-dto';

import { DataSourceType } from '../../../../utils/datasource';
import { isPromOrLokiQuery } from '../../../../utils/rule-form';

import { isSQLLikeQuery, SQLQueryPreview } from './SQLQueryPreview';

const PrometheusQueryPreview = React.lazy(() => import('./PrometheusQueryPreview'));
const LokiQueryPreview = React.lazy(() => import('./LokiQueryPreview'));

interface DatasourceModelPreviewProps {
  model: AlertDataQuery;
}

function DatasourceModelPreview({ model }: DatasourceModelPreviewProps): React.ReactNode {
  const { datasource } = model;

  if (datasource?.type === DataSourceType.Prometheus && isPromOrLokiQuery(model)) {
    return <PrometheusQueryPreview query={model.expr} />;
  }

  if (datasource?.type === DataSourceType.Loki && isPromOrLokiQuery(model)) {
    return <LokiQueryPreview query={model.expr ?? ''} />;
  }

  if (isSQLLikeQuery(model)) {
    return <SQLQueryPreview expression={model.rawSql} />;
  }

  return (
    <pre>
      <code>{dump(model)}</code>
    </pre>
  );
}

export { DatasourceModelPreview };
