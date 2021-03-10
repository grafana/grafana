import React, { FC } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';
import { InfluxOptions, InfluxQuery } from '../types';
import InfluxDatasource from '../datasource';
import { FluxQueryEditor } from './FluxQueryEditor';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
import { Editor as VisualInfluxQLEditor } from './VisualInfluxQLEditor/Editor';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>;

export const QueryEditor: FC<Props> = ({ query, onChange, onRunQuery, datasource, range, data }) => {
  if (datasource.isFlux) {
    // FIXME: we should clean up the flux-query-editor part too,
    // but it is used at multiple places, so for now we leave it as it is.
    return (
      <div className="gf-form-query-content">
        <FluxQueryEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />;
      </div>
    );
  }

  // we have to provide our own rawmode/visualmode switch. the "from the outside world" switch
  // only handles angular components
  return (
    <div>
      <RadioButtonGroup
        options={[
          { label: 'visual', value: false },
          { label: 'raw', value: true },
        ]}
        value={query.rawQuery ?? false}
        onChange={(value) => {
          onChange({ ...query, rawQuery: value });
        }}
      />
      {query.rawQuery ? (
        <RawInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />
      ) : (
        <VisualInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
      )}
    </div>
  );
};
