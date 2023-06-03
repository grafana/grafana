import React from 'react';

import { QueryEditorProps } from '@grafana/data/src';
import config from 'app/core/config';

import InfluxDatasource from '../../../datasource';
import { InfluxOptions, InfluxQuery, InfluxVersion } from '../../../types';

import { FluxQueryEditor } from './flux/FluxQueryEditor';
import { InfluxQlEditor } from './influxql/InfluxQLEditor';

type Props = QueryEditorProps<InfluxDatasource, InfluxQuery, InfluxOptions>;

export const QueryEditor = ({ query, onChange, onRunQuery, datasource, range, data }: Props): JSX.Element => {
  switch (datasource.languageVersion) {
    case InfluxVersion.Flux:
      return (
        <div className="gf-form-query-content">
          <FluxQueryEditor query={query} onChange={onChange} onRunQuery={onRunQuery} datasource={datasource} />
        </div>
      );
    case InfluxVersion.InfluxQL:
      return (
        <InfluxQlEditor
          onRunQuery={onRunQuery}
          query={query}
          onChange={onChange}
          datasource={datasource}
          backendMigration={!!config.featureToggles.influxdbBackendMigration}
        />
      );
    default:
      return <>Unknown InfluxDB Query Language</>;
  }
};
