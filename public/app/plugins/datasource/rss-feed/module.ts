import { DataSourcePlugin } from '@grafana/data';

import { RSSFeedDatasource } from './RSSFeedDatasource';

import { RSSFeedConfigEditor } from './RSSFeedConfigEditor';
// import { RSSFeedOptions, RSSFeedQuery } from './types';

export const plugin = new DataSourcePlugin(RSSFeedDatasource).setConfigEditor(RSSFeedConfigEditor);
