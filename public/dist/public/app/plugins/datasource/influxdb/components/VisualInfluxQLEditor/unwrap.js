export function unwrap(value) {
    if (value == null) {
        throw new Error('value must not be nullish');
    }
    return value;
}
//# sourceMappingURL=unwrap.js.map