import { dump } from 'js-yaml';
import * as React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { AlertDataQuery } from 'app/types/unified-alerting-dto';

import { DataSourceType, isSupportedExternalPrometheusFlavoredRulesSourceType } from '../../../../utils/datasource';
import { isPromOrLokiQuery } from '../../../../utils/rule-form';

import { SQLQueryPreview, isSQLLikeQuery } from './SQLQueryPreview';

const PrometheusQueryPreview = React.lazy(() => import('./PrometheusQueryPreview'));
const LokiQueryPreview = React.lazy(() => import('./LokiQueryPreview'));

interface DatasourceModelPreviewProps {
  model: AlertDataQuery;
  dataSource: DataSourceInstanceSettings;
}

function DatasourceModelPreview({ model, dataSource: datasource }: DatasourceModelPreviewProps): React.ReactNode {
  if (isSupportedExternalPrometheusFlavoredRulesSourceType(datasource.type) && isPromOrLokiQuery(model)) {
    return <PrometheusQueryPreview query={model.expr} />;
  }

  if (datasource.type === DataSourceType.Loki && isPromOrLokiQuery(model)) {
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
