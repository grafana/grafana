// Libraries
import React, { memo } from 'react';

// Types
import { AbsoluteTimeRange } from '@grafana/data';
import { QueryEditorProps, Switch, DataSourceStatus } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';
import { useLokiSyntax } from './useLokiSyntax';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

export const LokiQueryEditor = memo(function LokiQueryEditor(props: Props) {
  const { query, data, datasource, onChange, onRunQuery } = props;

  let absolute: AbsoluteTimeRange;
  if (data && data.request) {
    const { range } = data.request;
    absolute = {
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };
  } else {
    absolute = {
      from: Date.now() - 10000,
      to: Date.now(),
    };
  }

  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider,
    // TODO maybe use real status
    DataSourceStatus.Connected,
    absolute
  );

  return (
    <div>
      <LokiQueryField
        datasource={datasource}
        datasourceStatus={DataSourceStatus.Connected}
        query={query}
        onChange={onChange}
        onRunQuery={onRunQuery}
        history={[]}
        data={data}
        onLoadOptions={setActiveOption}
        onLabelsRefresh={refreshLabels}
        syntaxLoaded={isSyntaxReady}
        absoluteRange={absolute}
        {...syntaxProps}
      />
      <div className="gf-form-inline">
        <div className="gf-form">
          <Switch label="Live" checked={!!query.live} onChange={() => onChange({ ...query, live: !query.live })} />
        </div>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" />
        </div>
      </div>
    </div>
  );
});

export default LokiQueryEditor;
