import { DataQuery, DataSourceJsonData, DataSourcePlugin } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import React from 'react';

class DataSource extends DataSourceWithBackend<DataQuery, DataSourceJsonData> {}

const ConfigEditor = () => <div />;
const MetaInspector = () => <div />;
const QueryEditor = () => <div />;

export const plugin = new DataSourcePlugin<DataSource, DataQuery, DataSourceJsonData>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setMetadataInspector(MetaInspector);
