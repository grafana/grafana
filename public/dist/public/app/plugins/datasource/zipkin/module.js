import { DataSourcePlugin } from '@grafana/data';
import { ZipkinDatasource } from './datasource';
import { ZipkinQueryField } from './QueryField';
import { ConfigEditor } from './ConfigEditor';
export var plugin = new DataSourcePlugin(ZipkinDatasource)
    .setConfigEditor(ConfigEditor)
    .setExploreQueryField(ZipkinQueryField);
//# sourceMappingURL=module.js.map