// Libraries
import React, { memo } from 'react';

// Types
import { LokiQuery } from '../types';
import { useLokiLabels } from './useLokiLabels';
import { LokiQueryFieldForm } from './LokiQueryFieldForm';
import LokiDatasource from '../datasource';

interface Props {
  expr: string;
  maxLines?: number;
  instant?: boolean;
  datasource: LokiDatasource;
  onChange: (query: LokiQuery) => void;
}

export const LokiAnnotationsQueryEditor = memo(function LokiAnnotationQueryEditor(props: Props) {
  const { expr, maxLines, instant, datasource, onChange } = props;

  // Timerange to get existing labels from. Hard coding like this seems to be good enough right now.
  const absolute = {
    from: Date.now() - 10000,
    to: Date.now(),
  };

  const { setActiveOption, refreshLabels, logLabelOptions, labelsLoaded } = useLokiLabels(
    datasource.languageProvider,
    absolute
  );

  const queryWithRefId: LokiQuery = {
    refId: '',
    expr,
    maxLines,
    instant,
  };
  return (
    <div className="gf-form-group">
      <LokiQueryFieldForm
        datasource={datasource}
        query={queryWithRefId}
        onChange={onChange}
        onRunQuery={() => {}}
        history={[]}
        onLoadOptions={setActiveOption}
        onLabelsRefresh={refreshLabels}
        absoluteRange={absolute}
        labelsLoaded={labelsLoaded}
        logLabelOptions={logLabelOptions}
      />
    </div>
  );
});
