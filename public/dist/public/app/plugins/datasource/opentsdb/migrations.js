// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json) => {
    var _a, _b, _c;
    // return the target annotation
    const annotation = {
        fromAnnotations: true,
        target: (_a = json.target) !== null && _a !== void 0 ? _a : '',
        name: (_b = json.name) !== null && _b !== void 0 ? _b : '',
        isGlobal: (_c = json.isGlobal) !== null && _c !== void 0 ? _c : false,
    };
    return annotation;
};
// eslint-ignore-next-line
export const prepareAnnotation = (json) => {
    const resultingTarget = json.target && typeof json.target !== 'string' ? json.target : migrateLegacyAnnotation(json);
    json.target = resultingTarget;
    return json;
};
//# sourceMappingURL=migrations.js.map