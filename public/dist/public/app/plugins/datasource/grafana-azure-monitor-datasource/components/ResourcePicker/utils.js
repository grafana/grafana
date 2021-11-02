import { __values } from "tslib";
import produce from 'immer';
// This regex matches URIs representing:
//  - subscriptions: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572
//  - resource groups: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources
//  - resources: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM
var RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscriptionID>[^/]+)(?:\/resourceGroups\/(?<resourceGroup>[^/]+)(?:\/providers.+\/(?<resource>[^/]+))?)?/;
export function parseResourceURI(resourceURI) {
    var _a;
    var matches = RESOURCE_URI_REGEX.exec(resourceURI);
    var groups = (_a = matches === null || matches === void 0 ? void 0 : matches.groups) !== null && _a !== void 0 ? _a : {};
    var subscriptionID = groups.subscriptionID, resourceGroup = groups.resourceGroup, resource = groups.resource;
    if (!subscriptionID) {
        return undefined;
    }
    return { subscriptionID: subscriptionID, resourceGroup: resourceGroup, resource: resource };
}
export function isGUIDish(input) {
    return !!input.match(/^[A-Z0-9]+/i);
}
export function findRow(rows, id) {
    var e_1, _a;
    try {
        for (var rows_1 = __values(rows), rows_1_1 = rows_1.next(); !rows_1_1.done; rows_1_1 = rows_1.next()) {
            var row = rows_1_1.value;
            if (row.id.toLowerCase() === id.toLowerCase()) {
                return row;
            }
            if (row.children) {
                var result = findRow(row.children, id);
                if (result) {
                    return result;
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (rows_1_1 && !rows_1_1.done && (_a = rows_1.return)) _a.call(rows_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return undefined;
}
export function addResources(rows, targetResourceGroupID, newResources) {
    return produce(rows, function (draftState) {
        var draftRow = findRow(draftState, targetResourceGroupID);
        if (!draftRow) {
            // This case shouldn't happen often because we're usually coming here from a resource we already have
            throw new Error('Unable to find resource');
        }
        draftRow.children = newResources;
    });
}
//# sourceMappingURL=utils.js.map