import { DataSourcePlugin } from '@grafana/data';

import DockerDatasource from "./datasource";

import { DockerQueryEditor } from './components/DockerQueryEditor';
import { ConfigEditor } from './configuration/ConfigEditor';

export const plugin = new DataSourcePlugin(DockerDatasource)
    .setQueryEditor(DockerQueryEditor)
    .setConfigEditor(ConfigEditor)
