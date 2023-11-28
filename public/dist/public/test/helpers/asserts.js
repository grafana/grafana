export function assertInstanceOf(value, type) {
    if (!(value instanceof type)) {
        throw new Error(`Expected value to be an instanceof ${typeof type} but got ${typeof value}`);
    }
    return value;
}
export function assertIsDefined(value) {
    if (value == null) {
        throw new Error(`Expected value to not be null but got ${typeof value}`);
    }
    return value;
}
//# sourceMappingURL=asserts.js.map