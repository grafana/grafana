/**
 * This file is used to share internal grafana/runtime code with Grafana core.
 * Note that these exports are also used within Enterprise.
 *
 * Through the exports declared in package.json we can import this code in core Grafana and the grafana/runtime
 * package will continue to be able to access all code when it's published to npm as it's private to the package.
 *
 * During the yarn pack lifecycle the exports[./internal] property is deleted from the package.json
 * preventing the code from being importable by plugins or other npm packages making it truly "internal".
 *
 */

export { setPanelDataErrorView } from '../components/PanelDataErrorView';
export { setPanelRenderer } from '../components/PanelRenderer';
export { type PageInfoItem, setPluginPage } from '../components/PluginPage';

export { ExpressionDatasourceRef } from '../utils/DataSourceWithBackend';
export { standardStreamOptionsProvider, toStreamingDataResponse } from '../utils/DataSourceWithBackend';

export {
  setGetObservablePluginComponents,
  type GetObservablePluginComponents,
} from '../services/pluginExtensions/getObservablePluginComponents';
export {
  setGetObservablePluginLinks,
  type GetObservablePluginLinks,
} from '../services/pluginExtensions/getObservablePluginLinks';

export { UserStorage } from '../utils/userStorage';

export { type GetUrlMetadataOptions, type GetUrlMetadataResult } from '../services/pluginExtensions/getUrlMetadata';
