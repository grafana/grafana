/** @ngInject */
export default class StackdriverDatasource {
  id: number;
  url: string;
  baseUrl: string;

  constructor(instanceSettings, private backendSrv) {
    this.baseUrl = `/stackdriver/`;
    this.url = instanceSettings.url;
    this.doRequest = this.doRequest;
    this.id = instanceSettings.id;
  }

  async query(options) {
    const queries = options.targets.filter(target => !target.hide).map(t => ({
      refId: t.refId,
      datasourceId: this.id,
      metricType: `metric.type="${t.metricType}"`,
    }));

    const result = [];

    try {
      const { data } = await this.backendSrv.datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries,
        },
      });

      if (data.results) {
        Object['values'](data.results).forEach(queryRes => {
          queryRes.series.forEach(series => {
            result.push({ target: series.name, datapoints: series.points });
          });
        });
      }
    } catch (error) {
      console.log(error);
    }

    return { data: result };
  }

  testDatasource() {
    const path = `v3/projects/raintank-production/metricDescriptors`;
    return this.doRequest(`${this.baseUrl}${path}`)
      .then(response => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully queried the Stackdriver API.',
            title: 'Success',
          };
        }

        return {
          status: 'error',
          message: 'Returned http status code ' + response.status,
        };
      })
      .catch(error => {
        let message = 'Stackdriver: ';
        message += error.statusText ? error.statusText + ': ' : '';

        if (error.data && error.data.error && error.data.error.code) {
          // 400, 401
          message += error.data.error.code + '. ' + error.data.error.message;
        } else {
          message += 'Cannot connect to Stackdriver API';
        }
        return {
          status: 'error',
          message: message,
        };
      });
  }

  async getProjects() {
    const response = await this.doRequest(`/cloudresourcemanager/v1/projects`);
    return response.data.projects.map(p => ({ id: p.projectId, name: p.name }));
  }

  async getMetricTypes(projectId: string) {
    try {
      const metricsApiPath = `v3/projects/${projectId}/metricDescriptors`;
      const { data } = await this.doRequest(`${this.baseUrl}${metricsApiPath}`);
      return data.metricDescriptors.map(m => ({ id: m.type, name: m.displayName }));
    } catch (error) {
      console.log(error);
    }
  }

  async doRequest(url, maxRetries = 1) {
    return this.backendSrv
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch(error => {
        if (maxRetries > 0) {
          return this.doRequest(url, maxRetries - 1);
        }

        throw error;
      });
  }
}
