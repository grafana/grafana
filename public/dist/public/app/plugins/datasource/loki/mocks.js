import { LOKI_ENDPOINT } from './datasource';
import { createDatasourceSettings } from '../../../features/datasources/mocks';
export function makeMockLokiDatasource(labelsAndValues, series) {
    var lokiLabelsAndValuesEndpointRegex = /^\/loki\/api\/v1\/label\/(\w*)\/values/;
    var lokiSeriesEndpointRegex = /^\/loki\/api\/v1\/series/;
    var lokiLabelsEndpoint = LOKI_ENDPOINT + "/label";
    var rangeMock = {
        start: 1560153109000,
        end: 1560163909000,
    };
    var labels = Object.keys(labelsAndValues);
    return {
        getTimeRangeParams: function () { return rangeMock; },
        metadataRequest: function (url, params) {
            if (url === lokiLabelsEndpoint) {
                return labels;
            }
            else {
                var labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
                var seriesMatch = url.match(lokiSeriesEndpointRegex);
                if (labelsMatch) {
                    return labelsAndValues[labelsMatch[1]] || [];
                }
                else if (seriesMatch && series && params) {
                    return series[params['match[]']] || [];
                }
                else {
                    throw new Error("Unexpected url error, " + url);
                }
            }
        },
    };
}
export function createDefaultConfigOptions() {
    return createDatasourceSettings({
        maxLines: '531',
    });
}
//# sourceMappingURL=mocks.js.map