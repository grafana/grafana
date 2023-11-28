// Recursively converts object keys to camelCase. Useful for payload conversions
// Usage: <CamelCasedPayloadType>payloadToCamelCase(payload)
export const payloadToCamelCase = (object, ignoredKeys = []) => {
    // We use an outer function just to help with typings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recursive = (o) => {
        if (o === Object(o) && !Array.isArray(o) && typeof o !== 'function') {
            const n = {};
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            Object.keys(o).forEach((key) => {
                const toStrKey = key.toString();
                if (ignoredKeys.includes(toStrKey)) {
                    n[toStrKey] = o[key];
                }
                else {
                    const camelCaseKey = toStrKey.replace(/([-_][a-z])/gi, ($1) => $1.toUpperCase().replace('_', '').replace('-', ''));
                    n[camelCaseKey] = recursive(o[key]);
                }
            });
            return n;
        }
        else if (Array.isArray(o)) {
            return o.map((i) => recursive(i));
        }
        return o;
    };
    return recursive(object);
};
//# sourceMappingURL=payloadToCamelCase.js.map