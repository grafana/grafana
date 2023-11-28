import { applyQueryDefaults } from '../defaults';
export default function migrateAnnotation(annotation) {
    var _a;
    const oldQuery = typeof annotation.rawQuery === 'string' ? annotation.rawQuery : null;
    if (!oldQuery) {
        return annotation;
    }
    const newQuery = applyQueryDefaults(Object.assign(Object.assign({ refId: 'Annotation' }, ((_a = annotation.target) !== null && _a !== void 0 ? _a : {})), { rawSql: oldQuery }));
    return Object.assign(Object.assign({}, annotation), { rawQuery: undefined, workspace: undefined, subscription: undefined, queryType: undefined, target: newQuery });
}
//# sourceMappingURL=migration.js.map