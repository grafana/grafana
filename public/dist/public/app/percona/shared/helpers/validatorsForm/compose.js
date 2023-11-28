export const compose = (validators, getValue) => (value, values, meta) => {
    let result;
    // eslint-disable-next-line no-restricted-syntax
    for (const validator of validators) {
        if (getValue) {
            result = validator(getValue(value), values, meta);
        }
        else {
            result = validator(value, values, meta);
        }
        if (result !== undefined) {
            break;
        }
    }
    return result;
};
//# sourceMappingURL=compose.js.map