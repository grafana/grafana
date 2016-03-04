export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
  }

  // Called once per panel (graph)
  query(options) {
    var query = this.buildQueryParameters(options);

    if (query.targets.length <= 0) {
      return this.q.when([]);
    }

    return this.backendSrv.datasourceRequest({
      url: this.url + '/query',
      data: query,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Required
  // Used for testing datasource in datasource configuration pange
  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/',
      method: 'GET'
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  annotationQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: options
    }).then(result => {
      return result.data;
    });
  }

  // Optional
  // Required for templating
  metricFindQuery(options) {
    return this.backendSrv.datasourceRequest({
      url: this.url + '/search',
      data: options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(this.mapToTextValue);
  }

  mapToTextValue(result) {
    return _.map(result.data, (d, i) => {
      return { text: d, value: i};
    });
  }

  buildQueryParameters(options) {
    //remove placeholder targets
    options.targets = _.filter(options.targets, target => {
      return target.target !== 'select metric';
    });

    return options;
  }
}
