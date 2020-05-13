+++
title = "plugin.json"
keywords = ["grafana", "plugins", "documentation"]
type = "docs"
aliases = ["/docs/grafana/latest/plugins/developing/plugin.json/"]
+++

# plugin.json

The plugin.json file is mandatory for all plugins. When Grafana starts it will scan the plugin folders and mount every folder that contains a plugin.json file unless the folder contains a subfolder named `dist`. In that case grafana will mount the `dist` folder instead.

## Structure

The meta data has some top level properties as well as several sections:

- `dependencies`
- `info`
- `queryoptions`
- `routes`

## Schema

| Property                                | Type    | Required | Description                                                                                                                          |
| --------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| id                                      | string  | yes      | Unique name of the plugin. If the plugin is published on Grafana.com then the plugin id has to follow the naming conventions.        |
| type                                    | string  | yes      | Plugin type. Possible values are `app`, `datasource`, `panel`.                                                                       |
| name                                    | string  | yes      | Human-readable name of the plugin that is shown to the user in the UI.                                                               |
| category                                | string  | no       | Plugin category used on the Add data source page. Possible values are: `tsdb`, `logging`, `cloud`, `tracing`, `sql`.                 |
| annotations                             | boolean | no       | For data source plugins. If the plugin supports annotation queries.                                                                  |
| alerting                                | boolean | no       | For data source plugins. If the plugin supports alerting.                                                                            |
| backend                                 | boolean | no       | If the plugin has a backend component.                                                                                               |
| executable                              | string  | no       | The first part of the file name of the backend component executables (there can three binaries for linux, darwin and windows).       |
| logs                                    | boolean | no       | For data source plugins. If the plugin supports logs.                                                                                |
| metrics                                 | boolean | no       | For data source plugins. If the plugin supports metric queries. Used in the Explore feature.                                         |
| mixed                                   | boolean | no       | Not to be used by external plugins. Special property for the built-in mixed plugin.                                                  |
| sort                                    | number  | no       | Internal property for sorting. Cannot be used as will be overwritten by Grafana.                                                     |
| streaming                               | boolean | no       | For data source plugins. If the plugin supports streaming.                                                                           |
| tracing                                 | boolean | no       | For data source plugins. If the plugin supports tracing.                                                                             |
| hasQueryHelp                            | boolean | no       | For data source plugins. TODO not sure if this is used.                                                                              |
| dependencies                            | object  | yes      | Plugin dependencies.                                                                                                                 |
| dependencies.grafanaVersion             | string  | yes      | Required Grafana version for this plugin. TODO - format.                                                                             |
| dependencies.plugins                    | array   | no       | An array of required plugins on which this plugin depends.                                                                           |
| info                                    | object  | yes      | Meta data for the plugin. Some fields are used on the plugins page in Grafana and others on Grafana.com if the plugin is published.  |
| info.author                             | object  | no       | Information about the plugin author.                                                                                                 |
| info.author.name                        | string  | no       | Author's name.                                                                                                                       |
| info.author.url                         | string  | no       | Link to author's website.                                                                                                            |
| info.description                        | string  | no       | Description of plugin. Used on the plugins page in Grafana and for search on grafana.com.                                            |
| info.keywords                           | array   | no       | Array of plugin keywords. Used for search on grafana.com.                                                                            |
| info.links                              | array   | no       | An array of link objects to be displayed on this plugin's project page in the form `{name: 'foo', url: 'http://example.com'}`        |
| info.logos                              | object  | yes      | SVG images that are used as plugin icons.                                                                                            |
| info.logos.small                        | string  | yes      | Link to the "small" version of the plugin logo, which must be an SVG image. "Large" and "small" logos can be the same image.         |
| info.logos.large                        | string  | yes      | Link to the "large" version of the plugin logo, which must be an SVG image. "Large" and "small" logos can be the same image.         |
| info.screenshots                        | array   | no       | An array of screenshot objects in the form `{name: 'bar', path: 'img/screenshot.png'}`                                               |
| info.updated                            | string  | yes      | Date when this plugin was built. Use `%TODAY%` for Grafana to autopopulate this value.                                               |
| info.version                            | string  | yes      | Project version of this commit. Use `%VERSION%` for Grafana to autopopulate this value.                                              |
| queryOptions                            | object  | no       | For data source plugins. There is a query options section in the plugin's query editor and these options can be turned on if needed. |
| queryOptions.maxDataPoints              | boolean | no       | For data source plugins. If the `max data points` option should be shown in the query options section in the query editor.           |
| queryOptions.minInterval                | boolean | no       | For data source plugins. If the `min interval` option should be shown in the query options section in the query editor.              |
| queryOptions.cacheTimeout               | boolean | no       | For data source plugins. If the `cache timeout` option should be shown in the query options section in the query editor.             |
| routes                                  | array   | no       | For data source plugins. Proxy routes used for plugin authentication and adding headers to HTTP requests made by the plugin.         |
| routes[].path                           | string  | no       | For data source plugins. The route path that is replaced by the route url field when proxying the call.                              |
| routes[].method                         | string  | no       | For data source plugins. Route method matches the HTTP verb like GET or POST.                                                        |
| routes[].url                            | string  | no       | For data source plugins. Route url is where the request is proxied to.                                                               |
| routes[].headers                        | array   | no       | For data source plugins. Route headers adds HTTP headers to the proxied request.                                                     |
| routes[].headers[].name                 | array   | no       | For data source plugins. HTTP header name.                                                                                           |
| routes[].headers[].content              | array   | no       | For data source plugins. HTTP header value.                                                                                          |
| routes[].tokenAuth                      | object  | no       | For data source plugins. Token authentication section used with an OAuth API.                                                        |
| routes[].tokenAuth.url                  | string  | no       | For data source plugins. Url to fetch the authentication token.                                                                      |
| routes[].tokenAuth.params               | object  | no       | For data source plugins. Params for the token authentication request.                                                                |
| routes[].tokenAuth.params.grant_type    | string  | no       | For data source plugins. OAuth grant type.                                                                                           |
| routes[].tokenAuth.params.client_id     | string  | no       | For data source plugins. OAuth client id.                                                                                            |
| routes[].tokenAuth.params.client_secret | string  | no       | For data source plugins. OAuth client secret. Usually populated by decrypting the secret from the SecureJson blob.                   |
| routes[].tokenAuth.params.resource      | string  | no       | For data source plugins. OAuth resource.                                                                                             |

## Plugin.json Example

Here's an example of an up-to-date plugin.json file:

https://github.com/grafana/clock-panel/blob/master/src/plugin.json
