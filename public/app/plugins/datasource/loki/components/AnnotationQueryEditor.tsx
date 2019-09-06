// Libraries
import React, { memo } from 'react';

// Types
import { DataSourceStatus } from '@grafana/ui';
import { LokiQuery } from '../types';
import { useLokiSyntax } from './useLokiSyntax';
import { LokiQueryFieldForm } from './LokiQueryFieldForm';

export const LokiAnnotationQueryEditor = memo(function LokiAnnotationQueryEditor(props: any) {
  const { expr, datasource, onChange } = props;

  const absolute = {
    from: Date.now() - 10000,
    to: Date.now(),
  };

  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider,
    // TODO maybe use real status
    DataSourceStatus.Connected,
    absolute
  );

  const query: LokiQuery = {
    refId: '',
    expr,
  };

  return (
    <div>
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

export default LokiAnnotationQueryEditor;
