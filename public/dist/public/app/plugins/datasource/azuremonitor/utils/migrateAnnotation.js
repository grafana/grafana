import { AzureQueryType } from '../types';
// The old Angular annotations editor put some properties (rawQuery, workspace, subscription)
// on the root annotation object, rather than down in the 'targets' query value
// This migration moves them to a Log Analytics query compatible with the React query editor
// The old Angular annotations editor did not support any other query types.
export default function migrateAnnotation(annotation) {
    var _a, _b, _c, _d, _e;
    const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;
    const oldWorkspace = typeof annotation.workspace === 'string' ? annotation.workspace : null;
    if (!(oldQuery && oldWorkspace && !((_b = (_a = annotation.target) === null || _a === void 0 ? void 0 : _a.azureLogAnalytics) === null || _b === void 0 ? void 0 : _b.query))) {
        return annotation;
    }
    const newQuery = Object.assign(Object.assign({}, ((_c = annotation.target) !== null && _c !== void 0 ? _c : {})), { refId: (_e = (_d = annotation.target) === null || _d === void 0 ? void 0 : _d.refId) !== null && _e !== void 0 ? _e : 'Anno', queryType: AzureQueryType.LogAnalytics, azureLogAnalytics: {
            query: oldQuery,
            resources: [oldWorkspace],
        } });
    return Object.assign(Object.assign({}, annotation), { rawQuery: undefined, workspace: undefined, subscription: undefined, queryType: undefined, target: newQuery });
}
//# sourceMappingURL=migrateAnnotation.js.map