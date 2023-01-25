export function invalidNamespaceError() {
  return {
    status: 404,
    statusText: 'Not Found',
    data: {
      error: {
        code: 'InvalidResourceNamespace',
        message: "The resource namespace 'grafanadev' is invalid.",
      },
    },
    config: {
      url: 'api/datasources/proxy/31/azuremonitor/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/grafanadev/providers/grafanadev/select/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01&metricnamespace=select',
      method: 'GET',
      retry: 0,
      headers: {
        'X-Grafana-Org-Id': 1,
      },
      hideFromInspector: false,
    },
  };
}

export function invalidSubscriptionError() {
  return {
    status: 400,
    data: {
      error: {
        code: 'InvalidSubscriptionId',
        message: "The provided subscription identifier 'abc' is malformed or invalid.",
      },
    },
  };
}
