+++
title = "Add authentication for data source plugins"
type = "docs"
aliases = ["/docs/grafana/latest/plugins/developing/auth-for-datasources/",  "/docs/grafana/latest/developers/plugins/authentication/"]
+++

# Add authentication for data source plugins

This page explains how to use the Grafana data source proxy to authenticate against an third-party API from a data source plugin.

When a user saves a password or any other sensitive data as a data source option, Grafana encrypts the data and stores it in the Grafana database. Any encrypted data source options can only be decrypted on the Grafana server. This means that any data source that makes authenticated queries needs to request the decrypted data to be sent to the browser.

To minimize the amount of sensitive information sent to and from the browser, data source plugins can use the Grafana _data source proxy_. When using the data source proxy, any requests containing sensitive information go through the Grafana server. No sensitive data is sent to the browser after the data is saved.

Some data sources, like [Prometheus](https://grafana.com/docs/grafana/latest/features/datasources/prometheus/) and [InfluxDB](https://grafana.com/docs/grafana/latest/features/datasources/influxdb/), allow users to configure whether to use the data source proxy, through a setting called _access modes_.

## Add a proxy route to your plugin

To forward requests through the Grafana proxy, you need to configure one or more _routes_. A route specifies how the proxy transforms outgoing requests. All routes for a given plugin are defined in the [plugin.json]({{< relref "metadata.md" >}}) file.

Let's add a route to proxy requests to `https://api.example.com/foo/bar`.

1. Add the route to `plugin.json`. Note that you need to reload the Grafana server every time you make a change to your `plugin.json` file.

   ```json
   "routes": [
     {
       "path": "example",
       "url": "https://api.example.com"
     }
   ]
   ```

1. In the `DataSource`, extract the proxy URL from `instanceSettings` to a class property called `url`.

   ```ts
   export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
     url?: string;

     constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
       super(instanceSettings);

       this.url = instanceSettings.url;
     }

     // ...

   }
   ```

1. In the `query` method, make a request using [BackendSrv]({{< relref "../../packages_api/runtime/backendsrv.md" >}}).

   ```ts
   const routePath = '/example';

   getBackendSrv()
     .datasourceRequest({
       url: this.url + routePath + '/foo/bar',
       method: 'GET',
     });
   ```

## Add a dynamic proxy route to your plugin

In the example above, the URL stays the same for everyone using the plugin. Let's look at how you can create dynamic routes based on data source options that are provided by the user.

Many of the properties in the `route` object can use templates in the form of `{{ .JsonData.YOUR_OPTION_NAME }}`, where `YOUR_OPTION_NAME` is the name of a property in the `jsonData` object.

```json
"routes": [
  {
    "path": "example",
    "url": "https://api.example.com/projects/{{ .JsonData.projectId }}"
  }
]
```

You can also access sensitive data in your route configuration by changing `.JsonData` into `.SecureJsonData`.

```json
"routes": [
  {
    "path": "example",
    "url": "https://{{ .JsonData.username }}:{{ .SecureJsonData.password }}@api.example.com"
  }
]
```

Now you know how to define routes for your data source plugin. Next, let's look at how to authenticate requests for your routes.

## Configure the authentication method for a route

The Grafana proxy supports a number of different authentication methods. For more information on how to configure each authentication method, refer to [plugin.json]({{< relref "metadata.md" >}}).

For any sensitive data, make sure that you encrypt data source options, and that you use `{{ .SecureJsonData.YOUR_OPTION_NAME }}` when using sensitive data source options in your routes.

### Add HTTP header

To add HTTP headers to proxied requests, use the `headers` property.

```json
"routes": [
  {
    "path": "example",
    "url": "https://api.example.com",
    "headers": [
      {
        "name": "Authorization",
        "content": "Bearer {{ .SecureJsonData.apiToken }}"
      }
    ]
  }
]
```

### Add URL parameters

To add URL parameters to proxied requests, use the `urlParams` property.

```json
"routes": [
  {
    "path": "example",
    "url": "http://api.example.com",
    "urlParams": [
      {
        "name": "apiKey",
        "content": "{{ .SecureJsonData.apiKey }}"
      }
    ]
  }
]
```

### Enable token authentication

To enable token-based authentication for proxied requests, use the `tokenAuth` property.

Grafana automatically renews the token when it expires.

```json
"routes": [
  {
    "path": "example",
    "url": "https://api.example.com",
    "tokenAuth": {
      "url": "https://login.example.com/oauth2/token",
      "params": {
        "grant_type": "client_credentials",
        "client_id": "{{ .JsonData.clientId }}",
        "client_secret": "{{ .SecureJsonData.clientSecret }}"
      }
    }
  }
]
```
