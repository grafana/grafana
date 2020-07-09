// Libraries
import React, { memo } from 'react';

// Types
import { LokiQuery } from '../types';
import { useLokiSyntaxAndLabels } from './useLokiSyntaxAndLabels';
import { LokiQueryFieldForm } from './LokiQueryFieldForm';
import LokiDatasource from '../datasource';

interface Props {
  expr: string;
  datasource: LokiDatasource;
  onChange: (expr: string) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { expr, datasource, onChange } = props;

  // Timerange to get existing labels from. Hard coding like this seems to be good enough right now.
  const absolute = {
    from: Date.now() - 10000,
    to: Date.now(),
  };

  const { isSyntaxReady, setActiveOption, refreshLabels, syntax, logLabelOptions } = useLokiSyntaxAndLabels(
    datasource.languageProvider,
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
        query={query}
        onChange={(query: LokiQuery) => onChange(query.expr)}
        onRunQuery={() => {}}
        history={[]}
        onLoadOptions={setActiveOption}
        onLabelsRefresh={refreshLabels}
        absoluteRange={absolute}
        syntax={syntax}
        syntaxLoaded={isSyntaxReady}
        logLabelOptions={logLabelOptions}
      />
    </div>
  );
});
