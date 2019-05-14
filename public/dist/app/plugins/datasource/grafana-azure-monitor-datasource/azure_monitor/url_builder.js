var UrlBuilder = /** @class */ (function () {
    function UrlBuilder() {
    }
    UrlBuilder.buildAzureMonitorQueryUrl = function (baseUrl, resourceGroup, metricDefinition, resourceName, apiVersion, filter) {
        if ((metricDefinition.match(/\//g) || []).length > 1) {
            var rn = resourceName.split('/');
            var service = metricDefinition.substring(metricDefinition.lastIndexOf('/') + 1);
            var md = metricDefinition.substring(0, metricDefinition.lastIndexOf('/'));
            return (baseUrl + "/" + resourceGroup + "/providers/" + md + "/" + rn[0] + "/" + service + "/" + rn[1] +
                ("/providers/microsoft.insights/metrics?api-version=" + apiVersion + "&" + filter));
        }
        return (baseUrl + "/" + resourceGroup + "/providers/" + metricDefinition + "/" + resourceName +
            ("/providers/microsoft.insights/metrics?api-version=" + apiVersion + "&" + filter));
    };
    UrlBuilder.buildAzureMonitorGetMetricNamesUrl = function (baseUrl, resourceGroup, metricDefinition, resourceName, apiVersion) {
        if ((metricDefinition.match(/\//g) || []).length > 1) {
            var rn = resourceName.split('/');
            var service = metricDefinition.substring(metricDefinition.lastIndexOf('/') + 1);
            var md = metricDefinition.substring(0, metricDefinition.lastIndexOf('/'));
            return (baseUrl + "/" + resourceGroup + "/providers/" + md + "/" + rn[0] + "/" + service + "/" + rn[1] +
                ("/providers/microsoft.insights/metricdefinitions?api-version=" + apiVersion));
        }
        return (baseUrl + "/" + resourceGroup + "/providers/" + metricDefinition + "/" + resourceName +
            ("/providers/microsoft.insights/metricdefinitions?api-version=" + apiVersion));
    };
    return UrlBuilder;
}());
export default UrlBuilder;
//# sourceMappingURL=url_builder.js.map