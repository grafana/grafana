const defaultTransform = (params) => {
    if (params && params !== undefined && params !== null) {
        return typeof params === 'object' ? params.map((p) => String(p)) : [String(params)];
    }
    return [];
};
export const getValuesFromQueryParams = (queryParams, keys) => {
    let result = {};
    keys.forEach(({ key, transform = defaultTransform }) => {
        const param = queryParams[key];
        if (param !== undefined && param !== null) {
            result = Object.assign(Object.assign({}, result), { [key]: transform(param) });
        }
    });
    return result;
};
//# sourceMappingURL=getValuesFromQueryParams.js.map