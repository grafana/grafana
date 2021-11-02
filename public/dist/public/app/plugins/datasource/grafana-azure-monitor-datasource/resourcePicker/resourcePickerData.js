import { __assign, __awaiter, __extends, __generator, __values } from "tslib";
import { DataSourceWithBackend } from '@grafana/runtime';
import { locationDisplayNames, logsSupportedLocationsKusto, logsSupportedResourceTypesKusto, resourceTypeDisplayNames, } from '../azureMetadata';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { parseResourceURI } from '../components/ResourcePicker/utils';
import { routeNames } from '../utils/common';
var RESOURCE_GRAPH_URL = '/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01';
var ResourcePickerData = /** @class */ (function (_super) {
    __extends(ResourcePickerData, _super);
    function ResourcePickerData(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.resourcePath = "" + routeNames.resourceGraph;
        return _this;
    }
    ResourcePickerData.prototype.getResourcePickerData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, resources, allFetched, $skipToken, options, resourceResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n      resources\n        // Put subscription details on each row\n        | join kind=leftouter (\n          ResourceContainers\n            | where type == 'microsoft.resources/subscriptions'\n            | project subscriptionName=name, subscriptionURI=id, subscriptionId\n          ) on subscriptionId\n\n        // Put resource group details on each row\n        | join kind=leftouter (\n          ResourceContainers\n            | where type == 'microsoft.resources/subscriptions/resourcegroups'\n            | project resourceGroupURI=id, resourceGroupName=name, resourceGroup\n          ) on resourceGroup\n\n        | where type in (" + logsSupportedResourceTypesKusto + ")\n\n        // Get only unique resource groups and subscriptions. Also acts like a project\n        | summarize count() by resourceGroupName, resourceGroupURI, subscriptionName, subscriptionURI\n        | order by subscriptionURI asc\n    ";
                        resources = [];
                        allFetched = false;
                        $skipToken = undefined;
                        _a.label = 1;
                    case 1:
                        if (!!allFetched) return [3 /*break*/, 3];
                        options = {};
                        if ($skipToken) {
                            options = {
                                $skipToken: $skipToken,
                            };
                        }
                        return [4 /*yield*/, this.makeResourceGraphRequest(query, 1, options)];
                    case 2:
                        resourceResponse = _a.sent();
                        if (!resourceResponse.data.length) {
                            throw new Error('unable to fetch resource details');
                        }
                        resources = resources.concat(resourceResponse.data);
                        $skipToken = resourceResponse.$skipToken;
                        allFetched = !$skipToken;
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/, formatResourceGroupData(resources)];
                }
            });
        });
    };
    ResourcePickerData.prototype.getResourcesForResourceGroup = function (resourceGroup) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeResourceGraphRequest("\n      resources\n      | where id hasprefix \"" + resourceGroup.id + "\"\n      | where type in (" + logsSupportedResourceTypesKusto + ") and location in (" + logsSupportedLocationsKusto + ")\n    ")];
                    case 1:
                        response = (_a.sent()).data;
                        return [2 /*return*/, formatResourceGroupChildren(response)];
                }
            });
        });
    };
    ResourcePickerData.prototype.getResourceURIDisplayProperties = function (resourceURI) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var _b, subscriptionID, resourceGroup, subscriptionURI, resourceGroupURI, query, response;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = (_a = parseResourceURI(resourceURI)) !== null && _a !== void 0 ? _a : {}, subscriptionID = _b.subscriptionID, resourceGroup = _b.resourceGroup;
                        if (!subscriptionID) {
                            throw new Error('Invalid resource URI passed');
                        }
                        subscriptionURI = "/subscriptions/" + subscriptionID;
                        resourceGroupURI = subscriptionURI + "/resourceGroups/" + resourceGroup;
                        query = "\n      resourcecontainers\n        | where type == \"microsoft.resources/subscriptions\"\n        | where id =~ \"" + subscriptionURI + "\"\n        | project subscriptionName=name, subscriptionId\n\n        | join kind=leftouter (\n          resourcecontainers\n            | where type == \"microsoft.resources/subscriptions/resourcegroups\"\n            | where id =~ \"" + resourceGroupURI + "\"\n            | project resourceGroupName=name, resourceGroup, subscriptionId\n        ) on subscriptionId\n\n        | join kind=leftouter (\n          resources\n            | where id =~ \"" + resourceURI + "\"\n            | project resourceName=name, subscriptionId\n        ) on subscriptionId\n\n        | project subscriptionName, resourceGroupName, resourceName\n    ";
                        return [4 /*yield*/, this.makeResourceGraphRequest(query)];
                    case 1:
                        response = (_c.sent()).data;
                        if (!response.length) {
                            throw new Error('unable to fetch resource details');
                        }
                        return [2 /*return*/, response[0]];
                }
            });
        });
    };
    ResourcePickerData.prototype.getResourceURIFromWorkspace = function (workspace) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.makeResourceGraphRequest("\n      resources\n      | where properties['customerId'] == \"" + workspace + "\"\n      | project id\n    ")];
                    case 1:
                        response = (_a.sent()).data;
                        if (!response.length) {
                            throw new Error('unable to find resource for workspace ' + workspace);
                        }
                        return [2 /*return*/, response[0].id];
                }
            });
        });
    };
    ResourcePickerData.prototype.makeResourceGraphRequest = function (query, maxRetries, reqOptions) {
        if (maxRetries === void 0) { maxRetries = 1; }
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.postResource(this.resourcePath + RESOURCE_GRAPH_URL, {
                                query: query,
                                options: __assign({ resultFormat: 'objectArray' }, reqOptions),
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_1 = _a.sent();
                        if (maxRetries > 0) {
                            return [2 /*return*/, this.makeResourceGraphRequest(query, maxRetries - 1)];
                        }
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ResourcePickerData.prototype.transformVariablesToRow = function (templateVariables) {
        return {
            id: ResourcePickerData.templateVariableGroupID,
            name: 'Template variables',
            type: ResourceRowType.VariableGroup,
            typeLabel: 'Variables',
            children: templateVariables.map(function (v) { return ({
                id: v,
                name: v,
                type: ResourceRowType.Variable,
                typeLabel: 'Variable',
            }); }),
        };
    };
    ResourcePickerData.templateVariableGroupID = '$$grafana-templateVariables$$';
    return ResourcePickerData;
}(DataSourceWithBackend));
export default ResourcePickerData;
function formatResourceGroupData(rawData) {
    var e_1, _a;
    // Subscriptions goes into the top level array
    var rows = [];
    var _loop_1 = function (row) {
        var resourceGroupRow = {
            name: row.resourceGroupName,
            id: row.resourceGroupURI,
            type: ResourceRowType.ResourceGroup,
            typeLabel: 'Resource Group',
            children: [],
        };
        var subscription = rows.find(function (v) { return v.id === row.subscriptionURI; });
        if (subscription) {
            if (!subscription.children) {
                subscription.children = [];
            }
            subscription.children.push(resourceGroupRow);
        }
        else {
            var newSubscriptionRow = {
                name: row.subscriptionName,
                id: row.subscriptionURI,
                typeLabel: 'Subscription',
                type: ResourceRowType.Subscription,
                children: [resourceGroupRow],
            };
            rows.push(newSubscriptionRow);
        }
    };
    try {
        // Array of all the resource groups, with subscription data on each row
        for (var rawData_1 = __values(rawData), rawData_1_1 = rawData_1.next(); !rawData_1_1.done; rawData_1_1 = rawData_1.next()) {
            var row = rawData_1_1.value;
            _loop_1(row);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (rawData_1_1 && !rawData_1_1.done && (_a = rawData_1.return)) _a.call(rawData_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return rows;
}
function formatResourceGroupChildren(rawData) {
    return rawData.map(function (item) { return ({
        name: item.name,
        id: item.id,
        resourceGroupName: item.resourceGroup,
        type: ResourceRowType.Resource,
        typeLabel: resourceTypeDisplayNames[item.type] || item.type,
        location: locationDisplayNames[item.location] || item.location,
    }); });
}
//# sourceMappingURL=resourcePickerData.js.map