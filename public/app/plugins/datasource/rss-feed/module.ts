import { DataSourcePlugin } from '@grafana/data';

import { RSSFeedDatasource } from './RSSFeedDatasource';

import { RSSFeedConfigEditor } from './RSSFeedConfigEditor';

export const plugin = new DataSourcePlugin(RSSFeedDatasource).setConfigEditor(RSSFeedConfigEditor);
