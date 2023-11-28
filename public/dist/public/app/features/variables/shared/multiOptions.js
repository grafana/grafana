export const alignCurrentWithMulti = (current, value) => {
    if (!current) {
        return current;
    }
    if (value && !Array.isArray(current.value)) {
        return Object.assign(Object.assign({}, current), { value: convertToMulti(current.value), text: convertToMulti(current.text) });
    }
    if (!value && Array.isArray(current.value)) {
        return Object.assign(Object.assign({}, current), { value: convertToSingle(current.value), text: convertToSingle(current.text) });
    }
    return current;
};
const convertToSingle = (value) => {
    if (!Array.isArray(value)) {
        return value;
    }
    if (value.length > 0) {
        return value[0];
    }
    return '';
};
const convertToMulti = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
};
//# sourceMappingURL=multiOptions.js.map