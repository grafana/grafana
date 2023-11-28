import { __asyncValues, __awaiter } from "tslib";
import { uniq } from 'lodash';
import { DataSourceWithBackend, reportInteraction } from '@grafana/runtime';
import { logsResourceTypes, resourceTypeDisplayNames, resourceTypes } from '../azureMetadata';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { addResources, findRow, parseMultipleResourceDetails, parseResourceDetails, parseResourceURI, resourceToString, } from '../components/ResourcePicker/utils';
import { routeNames } from '../utils/common';
const RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';
const logsSupportedResourceTypesKusto = logsResourceTypes.map((v) => `"${v}"`).join(',');
export default class ResourcePickerData extends DataSourceWithBackend {
    constructor(instanceSettings, azureMonitorDatasource) {
        super(instanceSettings);
        this.resultLimit = 200;
        this.supportedMetricNamespaces = '';
        this.search = (searchPhrase, searchType) => __awaiter(this, void 0, void 0, function* () {
            let searchQuery = 'resources';
            if (searchType === 'logs') {
                searchQuery += `
      | union resourcecontainers`;
            }
            searchQuery += `
        | where id contains "${searchPhrase}"
        ${yield this.filterByType(searchType)}
        | order by tolower(name) asc
        | limit ${this.resultLimit}
      `;
            const { data: response } = yield this.makeResourceGraphRequest(searchQuery);
            return response.map((item) => {
                var _a;
                const parsedUri = parseResourceURI(item.id);
                if (!parsedUri || !(parsedUri.resourceName || parsedUri.resourceGroup || parsedUri.subscription)) {
                    throw new Error('unable to fetch resource details');
                }
                let id = (_a = parsedUri.subscription) !== null && _a !== void 0 ? _a : '';
                let type = ResourceRowType.Subscription;
                if (parsedUri.resourceName) {
                    id = parsedUri.resourceName;
                    type = ResourceRowType.Resource;
                }
                else if (parsedUri.resourceGroup) {
                    id = parsedUri.resourceGroup;
                    type = ResourceRowType.ResourceGroup;
                }
                return {
                    name: item.name,
                    id,
                    uri: item.id,
                    resourceGroupName: item.resourceGroup,
                    type,
                    typeLabel: resourceTypeDisplayNames[item.type] || item.type,
                    location: item.location,
                };
            });
        });
        this.filterByType = (t) => __awaiter(this, void 0, void 0, function* () {
            if (this.supportedMetricNamespaces === '' && t !== 'logs') {
                yield this.fetchAllNamespaces();
            }
            return t === 'logs'
                ? `| where type in (${logsSupportedResourceTypesKusto})`
                : `| where type in (${this.supportedMetricNamespaces})`;
        });
        this.resourcePath = `${routeNames.resourceGraph}`;
        this.azureMonitorDatasource = azureMonitorDatasource;
    }
    fetchInitialRows(type, currentSelection) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield this.getSubscriptions();
            if (!currentSelection) {
                return subscriptions;
            }
            let resources = subscriptions;
            const promises = currentSelection.map((selection) => () => __awaiter(this, void 0, void 0, function* () {
                if (selection.subscription) {
                    const resourceGroupURI = `/subscriptions/${selection.subscription}/resourceGroups/${selection.resourceGroup}`;
                    if (selection.resourceGroup && !findRow(resources, resourceGroupURI)) {
                        const resourceGroups = yield this.getResourceGroupsBySubscriptionId(selection.subscription, type);
                        resources = addResources(resources, `/subscriptions/${selection.subscription}`, resourceGroups);
                    }
                    const resourceURI = resourceToString(selection);
                    if (selection.resourceName && !findRow(resources, resourceURI)) {
                        const resourcesForResourceGroup = yield this.getResourcesForResourceGroup(resourceGroupURI, type);
                        resources = addResources(resources, resourceGroupURI, resourcesForResourceGroup);
                    }
                }
            }));
            for (const promise of promises) {
                // Fetch resources one by one, avoiding re-fetching the same resource
                // and race conditions updating the resources array
                yield promise();
            }
            return resources;
        });
    }
    fetchAndAppendNestedRow(rows, parentRow, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const nestedRows = parentRow.type === ResourceRowType.Subscription
                ? yield this.getResourceGroupsBySubscriptionId(parentRow.id, type)
                : yield this.getResourcesForResourceGroup(parentRow.id, type);
            return addResources(rows, parentRow.uri, nestedRows);
        });
    }
    // private
    getSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
    resources
    | join kind=inner (
              ResourceContainers
                | where type == 'microsoft.resources/subscriptions'
                | project subscriptionName=name, subscriptionURI=id, subscriptionId
              ) on subscriptionId
    | summarize count() by subscriptionName, subscriptionURI, subscriptionId
    | order by subscriptionName desc
  `;
            let resources = [];
            let allFetched = false;
            let $skipToken = undefined;
            while (!allFetched) {
                // The response may include several pages
                let options = {};
                if ($skipToken) {
                    options = {
                        $skipToken,
                    };
                }
                const resourceResponse = yield this.makeResourceGraphRequest(query, 1, options);
                if (!resourceResponse.data.length) {
                    throw new Error('No subscriptions were found');
                }
                resources = resources.concat(resourceResponse.data);
                $skipToken = resourceResponse.$skipToken;
                allFetched = !$skipToken;
            }
            return resources.map((subscription) => ({
                name: subscription.subscriptionName,
                id: subscription.subscriptionId,
                uri: `/subscriptions/${subscription.subscriptionId}`,
                typeLabel: 'Subscription',
                type: ResourceRowType.Subscription,
                children: [],
            }));
        });
    }
    getResourceGroupsBySubscriptionId(subscriptionId, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
    resources
     | join kind=inner (
       ResourceContainers
       | where type == 'microsoft.resources/subscriptions/resourcegroups'
       | project resourceGroupURI=id, resourceGroupName=name, resourceGroup, subscriptionId
     ) on resourceGroup, subscriptionId

     ${yield this.filterByType(type)}
     | where subscriptionId == '${subscriptionId}'
     | summarize count() by resourceGroupName, resourceGroupURI
     | order by resourceGroupURI asc`;
            let resourceGroups = [];
            let allFetched = false;
            let $skipToken = undefined;
            while (!allFetched) {
                // The response may include several pages
                let options = {};
                if ($skipToken) {
                    options = {
                        $skipToken,
                    };
                }
                const resourceResponse = yield this.makeResourceGraphRequest(query, 1, options);
                resourceGroups = resourceGroups.concat(resourceResponse.data);
                $skipToken = resourceResponse.$skipToken;
                allFetched = !$skipToken;
            }
            return resourceGroups.map((r) => {
                const parsedUri = parseResourceURI(r.resourceGroupURI);
                if (!parsedUri || !parsedUri.resourceGroup) {
                    throw new Error('unable to fetch resource groups');
                }
                return {
                    name: r.resourceGroupName,
                    uri: r.resourceGroupURI,
                    id: parsedUri.resourceGroup,
                    type: ResourceRowType.ResourceGroup,
                    typeLabel: 'Resource Group',
                    children: [],
                };
            });
        });
    }
    getResourcesForResourceGroup(resourceGroupId, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: response } = yield this.makeResourceGraphRequest(`
      resources
      | where id hasprefix "${resourceGroupId}"
      ${yield this.filterByType(type)}
    `);
            return response.map((item) => {
                const parsedUri = parseResourceURI(item.id);
                if (!parsedUri || !parsedUri.resourceName) {
                    throw new Error('unable to fetch resource details');
                }
                return {
                    name: item.name,
                    id: parsedUri.resourceName,
                    uri: item.id,
                    resourceGroupName: item.resourceGroup,
                    type: ResourceRowType.Resource,
                    typeLabel: resourceTypeDisplayNames[item.type] || item.type,
                    locationDisplayName: item.location,
                    location: item.location,
                };
            });
        });
    }
    // used to make the select resource button that launches the resource picker show a nicer file path to users
    getResourceURIDisplayProperties(resourceURI) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { subscription, resourceGroup, resourceName } = (_a = parseResourceDetails(resourceURI)) !== null && _a !== void 0 ? _a : {};
            if (!subscription) {
                throw new Error('Invalid resource URI passed');
            }
            // resourceGroupURI and resourceURI could be invalid values, but that's okay because the join
            // will just silently fail as expected
            const subscriptionURI = `/subscriptions/${subscription}`;
            const resourceGroupURI = `${subscriptionURI}/resourceGroups/${resourceGroup}`;
            const query = `
    resourcecontainers
    | where type == "microsoft.resources/subscriptions"
    | where id =~ "${subscriptionURI}"
    | project subscriptionName=name, subscriptionId

    | join kind=leftouter (
      resourcecontainers            
            | where type == "microsoft.resources/subscriptions/resourcegroups"
            | where id =~ "${resourceGroupURI}"
            | project resourceGroupName=name, resourceGroup, subscriptionId
        ) on subscriptionId

        | join kind=leftouter (
          resources
            | where id =~ "${resourceURI}"
            | project resourceName=name, subscriptionId
        ) on subscriptionId

        | project subscriptionName, resourceGroupName, resourceName
    `;
            const { data: response } = yield this.makeResourceGraphRequest(query);
            if (!response.length) {
                throw new Error('unable to fetch resource details');
            }
            const { subscriptionName, resourceGroupName, resourceName: responseResourceName } = response[0];
            // if the name is undefined it could be because the id is undefined or because we are using a template variable.
            // Either way we can use it as a fallback. We don't really want to interpolate these variables because we want
            // to show the user when they are using template variables `$sub/$rg/$resource`
            return {
                subscription: subscriptionName || subscription,
                resourceGroup: resourceGroupName || resourceGroup,
                resourceName: responseResourceName || resourceName,
            };
        });
    }
    getResourceURIFromWorkspace(workspace) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: response } = yield this.makeResourceGraphRequest(`
      resources
      | where properties['customerId'] == "${workspace}"
      | project id
    `);
            if (!response.length) {
                throw new Error('unable to find resource for workspace ' + workspace);
            }
            return response[0].id;
        });
    }
    makeResourceGraphRequest(query, maxRetries = 1, reqOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.postResource(this.resourcePath + RESOURCE_GRAPH_URL, {
                    query: query,
                    options: Object.assign({ resultFormat: 'objectArray' }, reqOptions),
                });
            }
            catch (error) {
                if (maxRetries > 0) {
                    return this.makeResourceGraphRequest(query, maxRetries - 1);
                }
                throw error;
            }
        });
    }
    fetchAllNamespaces() {
        var e_1, _a;
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield this.getSubscriptions();
            reportInteraction('grafana_ds_azuremonitor_subscriptions_loaded', { subscriptions: subscriptions.length });
            let supportedMetricNamespaces = [];
            try {
                for (var subscriptions_1 = __asyncValues(subscriptions), subscriptions_1_1; subscriptions_1_1 = yield subscriptions_1.next(), !subscriptions_1_1.done;) {
                    const subscription = subscriptions_1_1.value;
                    const namespaces = yield this.azureMonitorDatasource.getMetricNamespaces({
                        resourceUri: `/subscriptions/${subscription.id}`,
                    }, true);
                    if (namespaces) {
                        const namespaceVals = namespaces.map((namespace) => `"${namespace.value.toLocaleLowerCase()}"`);
                        supportedMetricNamespaces = supportedMetricNamespaces.concat(namespaceVals);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (subscriptions_1_1 && !subscriptions_1_1.done && (_a = subscriptions_1.return)) yield _a.call(subscriptions_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            if (supportedMetricNamespaces.length === 0) {
                throw new Error('Unable to resolve a list of valid metric namespaces. Validate the datasource configuration is correct and required permissions have been granted for all subscriptions. Grafana requires at least the Reader role to be assigned.');
            }
            this.supportedMetricNamespaces = uniq(supportedMetricNamespaces.concat(resourceTypes.map((namespace) => `"${namespace}"`))).join(',');
        });
    }
    parseRows(resources) {
        const resourceObjs = parseMultipleResourceDetails(resources);
        const newSelectedRows = [];
        resourceObjs.forEach((resource, i) => {
            var _a, _b, _c, _d;
            let id = resource.resourceName;
            let name = resource.resourceName;
            let rtype = ResourceRowType.Resource;
            if (!id) {
                id = resource.resourceGroup;
                name = resource.resourceGroup;
                rtype = ResourceRowType.ResourceGroup;
                if (!id) {
                    id = resource.subscription;
                    name = resource.subscription;
                    rtype = ResourceRowType.Subscription;
                }
            }
            newSelectedRows.push({
                id: id !== null && id !== void 0 ? id : '',
                name: name !== null && name !== void 0 ? name : '',
                type: rtype,
                uri: resourceToString(resource),
                typeLabel: (_d = (_c = resourceTypeDisplayNames[(_b = (_a = resource.metricNamespace) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '']) !== null && _c !== void 0 ? _c : resource.metricNamespace) !== null && _d !== void 0 ? _d : '',
                location: resource.region,
            });
        });
        return newSelectedRows;
    }
}
//# sourceMappingURL=resourcePickerData.js.map