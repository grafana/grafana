export const minLength = (length) => (value) => {
    if (value != null && value.length >= length) {
        return undefined;
    }
    return `Must contain at least ${length} characters`;
};
//# sourceMappingURL=minLength.js.map