// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json) => {
    var _a, _b, _c, _d, _e, _f;
    // eslint-ignore-next-line
    const target = {
        refId: '',
        query: (_a = json.query) !== null && _a !== void 0 ? _a : '',
        queryType: 'tags',
        fromAnnotations: true,
        tagsColumn: (_b = json.tagsColumn) !== null && _b !== void 0 ? _b : '',
        textColumn: (_c = json.textColumn) !== null && _c !== void 0 ? _c : '',
        timeEndColumn: (_d = json.timeEndColumn) !== null && _d !== void 0 ? _d : '',
        titleColumn: (_e = json.titleColumn) !== null && _e !== void 0 ? _e : '',
        name: (_f = json.name) !== null && _f !== void 0 ? _f : '',
    };
    // handle json target fields
    if (json.target && json.target.limit) {
        target.limit = json.target.limit;
    }
    if (json.target && json.target.matchAny) {
        target.matchAny = json.target.matchAny;
    }
    if (json.target && json.target.tags) {
        target.tags = json.target.tags;
    }
    if (json.target && json.target.type) {
        target.type = json.target.type;
    }
    return target;
};
// eslint-ignore-next-line
export const prepareAnnotation = (json) => {
    var _a;
    // make sure that any additional target fields are migrated
    json.target = json.target && !((_a = json.target) === null || _a === void 0 ? void 0 : _a.query) ? migrateLegacyAnnotation(json) : json.target;
    return json;
};
//# sourceMappingURL=migrations.js.map