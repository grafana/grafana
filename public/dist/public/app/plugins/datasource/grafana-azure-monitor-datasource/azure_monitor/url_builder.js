var UrlBuilder = /** @class */ (function () {
    function UrlBuilder() {
    }
    UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl = function (baseUrl, subscriptionId, resourceGroup, metricDefinition, resourceName, apiVersion) {
        var metricDefinitionArray = metricDefinition.split('/');
        var resourceNameArray = resourceName.split('/');
        var provider = metricDefinitionArray.shift();
        var urlArray = [baseUrl, subscriptionId, 'resourceGroups', resourceGroup, 'providers', provider];
        for (var i in metricDefinitionArray) {
            urlArray.push(metricDefinitionArray[i]);
            urlArray.push(resourceNameArray[i]);
        }
        var urlPrefix = urlArray.join('/');
        return urlPrefix + "/providers/microsoft.insights/metricNamespaces?api-version=" + apiVersion;
    };
    UrlBuilder.buildAzureMonitorGetMetricNamesUrl = function (baseUrl, subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace, apiVersion) {
        var metricDefinitionArray = metricDefinition.split('/');
        var resourceNameArray = resourceName.split('/');
        var provider = metricDefinitionArray.shift();
        var urlArray = [baseUrl, subscriptionId, 'resourceGroups', resourceGroup, 'providers', provider];
        for (var i in metricDefinitionArray) {
            urlArray.push(metricDefinitionArray[i]);
            urlArray.push(resourceNameArray[i]);
        }
        var urlPrefix = urlArray.join('/');
        return (urlPrefix + "/providers/microsoft.insights/metricdefinitions?api-version=" + apiVersion +
            ("&metricnamespace=" + encodeURIComponent(metricNamespace)));
    };
    return UrlBuilder;
}());
export default UrlBuilder;
//# sourceMappingURL=url_builder.js.map