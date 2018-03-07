/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

const
  baseURL = 'public/',
  basePluginURL = 'plugins/adremsoft-netcrunch-app/',
  baseDatasourceURL = `${basePluginURL}datasource/`,
  pluginURL = `${baseURL}${basePluginURL}`,
  imagesURL = `${pluginURL}images/`,
  datasourceURL = `${baseURL}${baseDatasourceURL}`,
  systemJSDatasourceURL = baseDatasourceURL,
  servicesModule = 'grafana.services',
  directivesModule = 'grafana.directives';

export {
  datasourceURL,
  pluginURL,
  imagesURL,
  systemJSDatasourceURL,
  servicesModule,
  directivesModule
};
