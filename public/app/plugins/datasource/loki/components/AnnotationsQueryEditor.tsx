// Libraries
import React, { memo } from 'react';

// Types
import { DataSourceApi, DataSourceJsonData, DataSourceStatus } from '@grafana/ui';
import { LokiQuery } from '../types';
import { useLokiSyntax } from './useLokiSyntax';
import { LokiQueryFieldForm } from './LokiQueryFieldForm';

interface Props {
  expr: string;
  datasource: DataSourceApi<LokiQuery, DataSourceJsonData>;
  onChange: (expr: string) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { expr, datasource, onChange } = props;

  // Timerange to get existing labels from. Hard coding like this seems to be good enough right now.
  const absolute = {
    from: Date.now() - 10000,
    to: Date.now(),
  };

  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider,
    DataSourceStatus.Connected,
    absolute
  );

  const query: LokiQuery = {
    refId: '',
    expr,
  };

  return (
    <div className="gf-form-group">
      <LokiQueryFieldForm
        datasource={datasource}
        datasourceStatus={DataSourceStatus.Connected}
        query={query}
        onChange={(query: LokiQuery) => onChange(query.expr)}
        onRunQuery={() => {}}
        history={[]}
        panelData={null}
        onLoadOptions={setActiveOption}
        onLabelsRefresh={refreshLabels}
        syntaxLoaded={isSyntaxReady}
        absoluteRange={absolute}
        {...syntaxProps}
      />
    </div>
  );
});
