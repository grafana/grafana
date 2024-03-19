import { dump } from 'js-yaml';
import React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { AlertDataQuery } from 'app/types/unified-alerting-dto';

import { DataSourceType } from '../../../../utils/datasource';
import { isPromOrLokiQuery } from '../../../../utils/rule-form';

import { isSQLLikeQuery, SQLQueryPreview } from './SQLQueryPreview';

const PrometheusQueryPreview = React.lazy(() => import('./PrometheusQueryPreview'));
const LokiQueryPreview = React.lazy(() => import('./LokiQueryPreview'));

interface DatasourceModelPreviewProps {
  model: AlertDataQuery;
  dataSource: DataSourceInstanceSettings;
}

function DatasourceModelPreview({ model, dataSource: datasource }: DatasourceModelPreviewProps): React.ReactNode {
  if (datasource.type === DataSourceType.Prometheus && isPromOrLokiQuery(model)) {
    return (
      <pre>
        <PrometheusQueryPreview query={model.expr} />
      </pre>
    );
  }

  if (datasource.type === DataSourceType.Loki && isPromOrLokiQuery(model)) {
    return (
      <pre>
        <LokiQueryPreview query={model.expr ?? ''} />
      </pre>
    );
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
