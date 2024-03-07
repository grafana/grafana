import { dump } from 'js-yaml';
import React from 'react';

import { ReactMonacoEditor } from '@grafana/ui';
import { AlertDataQuery } from 'app/types/unified-alerting-dto';

import { DataSourceType } from '../../../../utils/datasource';
import { isPromOrLokiQuery } from '../../../../utils/rule-form';

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
    return (
      <ReactMonacoEditor
        options={{
          readOnly: true,
          minimap: {
            enabled: false,
          },
          scrollBeyondLastColumn: 0,
          scrollBeyondLastLine: false,
          lineNumbers: 'off',
          cursorWidth: 0,
          overviewRulerLanes: 0,
        }}
        defaultLanguage="sql"
        height={80}
        defaultValue={model.rawSql}
        width="100%"
      />
    );
  }

  return (
    <pre>
      <code>{dump(model)}</code>
    </pre>
  );
}

interface SQLLike {
  refId: string;
  rawSql: string;
}

function isSQLLikeQuery(model: AlertDataQuery): model is SQLLike {
  return 'rawSql' in model;
}

export { DatasourceModelPreview };
