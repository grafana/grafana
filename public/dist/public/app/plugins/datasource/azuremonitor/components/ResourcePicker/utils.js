import { produce } from 'immer';
import { getTemplateSrv } from '@grafana/runtime';
import UrlBuilder from '../../azure_monitor/url_builder';
// This regex matches URIs representing:
//  - subscriptions: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572
//  - resource groups: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources
//  - resources: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM
const RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscription>[^/]+)(?:\/resourceGroups\/(?<resourceGroup>[^/]+)(?:\/providers\/(?<metricNamespaceAndResource>.+))?)?/;
function parseNamespaceAndName(metricNamespaceAndName) {
    if (!metricNamespaceAndName) {
        return {};
    }
    const stringArray = metricNamespaceAndName.split('/');
    // The first two groups belong to the namespace (e.g. Microsoft.Storage/storageAccounts)
    const namespaceArray = stringArray.splice(0, 2);
    // The next element belong to the resource name (e.g. storageAcc1)
    const resourceNameArray = stringArray.splice(0, 1);
    // If there are more elements, keep adding them to the namespace and resource name, alternatively
    // e.g (blobServices/default)
    while (stringArray.length) {
        const nextElem = stringArray.shift();
        stringArray.length % 2 === 0 ? resourceNameArray.push(nextElem) : namespaceArray.push(nextElem);
    }
    return { metricNamespace: namespaceArray.join('/'), resourceName: resourceNameArray.join('/') };
}
export function parseResourceURI(resourceURI) {
    var _a;
    const matches = RESOURCE_URI_REGEX.exec(resourceURI);
    const groups = (_a = matches === null || matches === void 0 ? void 0 : matches.groups) !== null && _a !== void 0 ? _a : {};
    const { subscription, resourceGroup, metricNamespaceAndResource } = groups;
    const { metricNamespace, resourceName } = parseNamespaceAndName(metricNamespaceAndResource);
    return { subscription, resourceGroup, metricNamespace, resourceName };
}
export function parseMultipleResourceDetails(resources, location) {
    return resources.map((resource) => {
        return parseResourceDetails(resource, location);
    });
}
export function parseResourceDetails(resource, location) {
    if (typeof resource === 'string') {
        const res = parseResourceURI(resource);
        if (location) {
            res.region = location;
        }
        return res;
    }
    return resource;
}
export function resourcesToStrings(resources) {
    return resources.map((resource) => resourceToString(resource));
}
export function resourceToString(resource) {
    return resource
        ? typeof resource === 'string'
            ? resource
            : UrlBuilder.buildResourceUri(getTemplateSrv(), resource)
        : '';
}
export function isGUIDish(input) {
    return !!input.match(/^[A-Z0-9]+/i);
}
function compareNamespaceAndName(rowNamespace, rowName, resourceNamespace, resourceName) {
    // StorageAccounts subresources are not listed independently
    if (resourceNamespace === null || resourceNamespace === void 0 ? void 0 : resourceNamespace.startsWith('microsoft.storage/storageaccounts')) {
        resourceNamespace = 'microsoft.storage/storageaccounts';
        if (resourceName === null || resourceName === void 0 ? void 0 : resourceName.endsWith('/default')) {
            resourceName = resourceName.slice(0, -'/default'.length);
        }
    }
    return rowNamespace === resourceNamespace && rowName === resourceName;
}
export function matchURI(rowURI, resourceURI) {
    var _a, _b, _c, _d;
    const targetParams = parseResourceDetails(resourceURI);
    const rowParams = parseResourceDetails(rowURI);
    return ((rowParams === null || rowParams === void 0 ? void 0 : rowParams.subscription) === (targetParams === null || targetParams === void 0 ? void 0 : targetParams.subscription) &&
        ((_a = rowParams === null || rowParams === void 0 ? void 0 : rowParams.resourceGroup) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === ((_b = targetParams === null || targetParams === void 0 ? void 0 : targetParams.resourceGroup) === null || _b === void 0 ? void 0 : _b.toLowerCase()) &&
        compareNamespaceAndName((_c = rowParams === null || rowParams === void 0 ? void 0 : rowParams.metricNamespace) === null || _c === void 0 ? void 0 : _c.toLowerCase(), rowParams === null || rowParams === void 0 ? void 0 : rowParams.resourceName, (_d = targetParams === null || targetParams === void 0 ? void 0 : targetParams.metricNamespace) === null || _d === void 0 ? void 0 : _d.toLowerCase(), targetParams === null || targetParams === void 0 ? void 0 : targetParams.resourceName));
}
export function findRows(rows, uris) {
    const result = [];
    uris.forEach((uri) => {
        const row = findRow(rows, uri);
        if (row) {
            result.push(row);
        }
    });
    return result;
}
export function findRow(rows, uri) {
    for (const row of rows) {
        if (matchURI(row.uri, uri)) {
            return row;
        }
        if (row.children) {
            const result = findRow(row.children, uri);
            if (result) {
                return result;
            }
        }
    }
    return undefined;
}
export function addResources(rows, targetParentId, newResources) {
    return produce(rows, (draftState) => {
        const draftRow = findRow(draftState, targetParentId);
        // we can't find the selected resource in our list of resources,
        // probably means user has either mistyped in the input field
        // or is using template variables.
        // either way no need to throw, just show that none of the resources are checked
        if (!draftRow) {
            return;
        }
        draftRow.children = newResources;
    });
}
export function setResources(query, type, resources) {
    var _a;
    if (type === 'logs') {
        // Resource URI for LogAnalytics
        return Object.assign(Object.assign({}, query), { azureLogAnalytics: Object.assign(Object.assign({}, query.azureLogAnalytics), { resources: resourcesToStrings(resources).filter((resource) => resource !== '') }) });
    }
    if (type === 'traces') {
        // Resource URI for Traces
        return Object.assign(Object.assign({}, query), { azureTraces: Object.assign(Object.assign({}, query.azureTraces), { resources: resourcesToStrings(resources).filter((resource) => resource !== '') }) });
    }
    // Resource object for metrics
    const parsedResource = resources.length ? parseResourceDetails(resources[0]) : {};
    return Object.assign(Object.assign({}, query), { subscription: parsedResource.subscription, azureMonitor: Object.assign(Object.assign({}, query.azureMonitor), { metricNamespace: (_a = parsedResource.metricNamespace) === null || _a === void 0 ? void 0 : _a.toLocaleLowerCase(), region: parsedResource.region, resources: parseMultipleResourceDetails(resources).filter((resource) => resource.resourceName !== '' &&
                resource.metricNamespace !== '' &&
                resource.subscription !== '' &&
                resource.resourceGroup !== ''), metricName: undefined, aggregation: undefined, timeGrain: '', dimensionFilters: [] }) });
}
//# sourceMappingURL=utils.js.map