+++
title = "Authentication for data source plugins"
type = "docs"
aliases = ["/docs/grafana/latest/plugins/developing/auth-for-datasources/"]
+++

# Authentication for data source plugins

Grafana has a proxy feature that proxies all data requests through the Grafana backend. The main benefit of using the proxy is secure handling of credentials when authenticating against an external/third-party API. The Grafana proxy also adds [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) headers to the proxied requests.

The proxy supports:

- [authentication with HTTP Headers]({{< relref "#api-key-http-header-authentication" >}}).
- [token authentication]({{< relref "#how-token-authentication-works" >}}) and can automatically renew a token for the user when the token expires.

## How the proxy works

The user saves the API key/password on the plugin config page and it is encrypted (using the `secureJsonData` feature) and saved in the Grafana database. When a request from the data source is made, the Grafana proxy will:

1. Intercept the original request sent from the data source plugin.
1. Load the `secureJsonData` data from the database and decrypt the API key or password on the Grafana backend.
1. If using token authentication, carry out authentication and generate an OAuth token that will be added as an `Authorization` HTTP header to the requests (or alternatively it will add a HTTP header with the API key).
1. Renew the token if it has expired.
1. After adding CORS headers and authorization headers, forward the request to the external API.

This means that users that access the data source config page cannot access the API key or password after they have saved it the first time and that no secret keys are sent in plain text through the browser where they can be spied on.

For backend authentication to work, the external/third-party API must either have an OAuth endpoint or that the API accepts an API key as a HTTP header for authentication.

## Encrypting sensitive data

When a user saves a password or secret with your data source plugin's Config page, then you can save data in an encrypted blob in the Grafana database called `secureJsonData`. Any data saved in the blob is encrypted by Grafana and can only be decrypted by the Grafana server on the backend. This means once a password is saved, no sensitive data is sent to the browser. If the password is saved in the `jsonData` blob or the `password` field then it is unencrypted and anyone with Admin access (with the help of Chrome Developer Tools) can read it.

This is an example of using the `secureJsonData` blob to save a property called `password` in a html input:

```html
<input type="password" class="gf-form-input" ng-model="ctrl.current.secureJsonData.password" placeholder="password" />
```

## Plugin routes

A plugin route describes where the intercepted request should be forwarded to and how to authenticate for the external API. You can define multiple routes that can match multiple external API endpoints.

You specify routes in the `plugin.json` file for your data source plugin. [Here is an example](https://github.com/grafana/azure-monitor-datasource/blob/d74c82145c0a4af07a7e96cc8dde231bfd449bd9/src/plugin.json#L30-L95) with lots of routes (though most plugins will just have one route).

When you build your URL to the third-party API in your data source class, the URL should start with the text specified in the path field for a route. The proxy will strip out the path text and replace it with the value in the URL field.

### Simple plugin route example

- If my code makes a call to URL `azuremonitor/foo/bar` with this code:

  ```js
  this.backendSrv.datasourceRequest({
    url: url,
    method: "GET",
  });
  ```

- and the plugin has this route:

  ```json
  "routes": [{
    "path": "azuremonitor",
    "method": "GET",
    "url": "https://management.azure.com"
  }]
  ```

- then the Grafana proxy will transform the URL from the original request into `https://management.azure.com/foo/bar`
- finally, it will add CORS headers and forward the request to the new URL. This example does not do any authentication.

The `method` parameter is optional. It can be set to a specific HTTP verb to provide more fine-grained control. For example you might have two plugin routes, one for GET requests and one for POST requests.

### Dynamic routes

When using routes, you can also reference a variable stored in JsonData or SecureJsonData which is interpolated (replacing the variable text with a value) when the data source makes a request to the proxy. These are variables that were entered by the user on the data source configuration page and saved in the Grafana database.

In this example, the value for `dynamicUrl` comes from the JsonData blob and the api key's value is set from the SecureJsonData blob. The `urlParams` field is for query string parameters for HTTP GET requests.

```json
"routes": [
  {
      "path": "custom/api/v5/*",
      "method": "GET",
      "url": "{{.JsonData.dynamicUrl}}",
      "urlParams": [
        {"name": "apiKey", "content": "{{.SecureJsonData.apiKey}}"}
      ]
  }
]
```

Given that:

- `JsonData.dynamicUrl` has the value `http://example.com/api`
- `SecureJsonData.apiKey` has the value `secretKey`

a call to the URL: `custom/api/v5/some/path`

will be proxied to the following URL: `http://example.com/api/some/path?apiKey=secretKey`

An app using this feature can be found [here](https://github.com/grafana/kentik-app).

## API key/HTTP header authentication

Some third-party API's accept a HTTP Header for authentication. The [example](https://github.com/grafana/azure-monitor-datasource/blob/d74c82145c0a4af07a7e96cc8dde231bfd449bd9/src/plugin.json#L91-L93) below has a `headers` section that defines the name of the HTTP Header that the API expects and it uses the `SecureJSONData` blob to fetch an encrypted API key. The Grafana server proxy will decrypt the key, add the `X-API-Key` header to the request and forward it to the third-party API.

```json
{
  "path": "appinsights",
  "method": "GET",
  "url": "https://api.applicationinsights.io",
  "headers": [{ "name": "X-API-Key", "content": "{{.SecureJsonData.appInsightsApiKey}}" }]
}
```

## How token authentication works

The token auth section in the `plugin.json` file looks like this:

```json
"tokenAuth": {
  "url": "https://login.microsoftonline.com/{{.JsonData.tenantId}}/oauth2/token",
  "params": {
    "grant_type":  "client_credentials",
    "client_id": "{{.JsonData.clientId}}",
    "client_secret": "{{.SecureJsonData.clientSecret}}",
    "resource": "https://management.azure.com/"
  }
}
```

This interpolates in data from both `jsonData` and `secureJsonData` to generate the token request to the third-party API. It is common for tokens to have a short expiry period (30 minutes). The Grafana proxy automatically renews the token if it has expired.

## Always restart the Grafana server after route changes

The plugin.json files are only loaded when the Grafana server starts so when a route is added or changed then the Grafana server has to be restarted for the changes to take effect.
