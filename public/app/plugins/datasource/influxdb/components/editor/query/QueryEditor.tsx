import { css } from '@emotion/css';

import { QueryEditorProps } from '@grafana/data';

import InfluxDatasource from '../../../datasource';
import { buildRawQuery } from '../../../queryUtils';
import { InfluxOptions, InfluxQuery, InfluxVersion } from '../../../types';

import { FluxQueryEditor } from './flux/FluxQueryEditor';
import { FSQLEditor } from './fsql/FSQLEditor';
import { QueryEditorModeSwitcher } from './influxql/QueryEditorModeSwitcher';
import { RawInfluxQLEditor } from './influxql/code/RawInfluxQLEditor';
import { VisualInfluxQLEditor as VisualInfluxQLEditor } from './influxql/visual/VisualInfluxQLEditor';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource }: Props) => {
  switch (datasource.version) {
    case InfluxVersion.Flux:
      return (
        <div className="gf-form-query-content">
          <FluxQueryEditor query={query} onChange={onChange} datasource={datasource} />
        </div>
      );
    case InfluxVersion.SQL:
      return <FSQLEditor datasource={datasource} query={query} onChange={onChange} onRunQuery={onRunQuery} />;
    case InfluxVersion.InfluxQL:
    default:
      return (
        <div className={css({ display: 'flex' })}>
          <div className={css({ flexGrow: 1 })}>
            {query.rawQuery ? (
              <RawInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} />
            ) : (
              <VisualInfluxQLEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
            )}
          </div>
          <QueryEditorModeSwitcher
            isRaw={query.rawQuery ?? false}
            onChange={(value) => {
              onChange({ ...query, query: buildRawQuery(query), rawQuery: value });
              onRunQuery();
            }}
          />
        </div>
      );
  }
};
