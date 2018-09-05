/** @ngInject */
export default class StackdriverDatasource {
  url: string;
  baseUrl: string;
  cloudName: string;

  constructor(instanceSettings, private backendSrv) {
    this.cloudName = 'stackdriver';
    this.baseUrl = `/${this.cloudName}/`;
    this.url = instanceSettings.url;
  }

  testDatasource() {
    const path = `v3/projects/raintank-production/timeSeries?aggregation.crossSeriesReducer=
    REDUCE_NONE&filter=metric.type%20%3D%20%22compute.googleapis.com%2Finstance%2Fcpu%2Fusage_time%
    22&aggregation.perSeriesAligner=ALIGN_NONE&interval.startTime=2018-09-04T05%3A16%3A02.383Z&interval.endTime=2018-09-04T11%3A16%3A02.383Z`;
    return this.doRequest(`${this.baseUrl}${path}`)
      .then(response => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully queried the Azure Monitor service.',
            title: 'Success',
          };
        } else {
          throw new Error();
        }
      })
      .catch(error => {
        let message = 'Azure Monitor: ';
        message += error.statusText ? error.statusText + ': ' : '';

        if (error.data && error.data.error && error.data.error.code) {
          message += error.data.error.code + '. ' + error.data.error.message;
        } else if (error.data && error.data.error) {
          message += error.data.error;
        } else if (error.data) {
          message += error.data;
        } else {
          message += 'Cannot connect to Azure Monitor REST API.';
        }
        return {
          status: 'error',
          message: message,
        };
      });
  }

  doRequest(url, maxRetries = 1) {
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
